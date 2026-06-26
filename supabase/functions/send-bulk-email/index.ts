import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BulkEmailRequest {
  subject: string;
  message: string;
  recipientTags: string[];
  recipientIds: string[];
  deliveryMethods?: {
    inApp: boolean;
    email: boolean;
  };
}

// Rate limiting: max 5 bulk emails per hour per user
const RATE_LIMIT_WINDOW_HOURS = 1;
const RATE_LIMIT_MAX_REQUESTS = 5;
const MAX_RECIPIENTS_PER_REQUEST = 200;

// Sanitize content for email safety - strip dangerous HTML/scripts
function sanitizeForEmail(content: string): string {
  // Remove script tags and their content
  let sanitized = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove iframe, object, embed, form tags
  sanitized = sanitized.replace(/<(iframe|object|embed|form|input|button|textarea|select)[^>]*>.*?<\/\1>/gi, '');
  sanitized = sanitized.replace(/<(iframe|object|embed|form|input|button|textarea|select)[^>]*\/?>/gi, '');
  // Remove event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');
  // Remove javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  // Remove data: URLs in href/src
  sanitized = sanitized.replace(/(href|src)\s*=\s*["']data:[^"']*["']/gi, '$1="#"');
  // Remove style expressions (IE)
  sanitized = sanitized.replace(/style\s*=\s*["'][^"']*expression\s*\([^"']*["']/gi, '');
  return sanitized;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      subject, 
      message, 
      recipientTags, 
      recipientIds,
      deliveryMethods = { inApp: true, email: false }
    }: BulkEmailRequest = await req.json();

    console.log("Received bulk notification request:", {
      subject,
      recipientTags,
      recipientIds,
      deliveryMethods,
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check user has admin or staff role
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error("Error checking user roles:", rolesError);
      throw new Error("Failed to verify permissions");
    }

    const roles = userRoles?.map(r => r.role) || [];
    const hasPermission = roles.includes('admin') || roles.includes('super_admin') || roles.includes('staff');

    if (!hasPermission) {
      throw new Error("Insufficient permissions: admin or staff role required for bulk emails");
    }

    // Rate limiting check
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recentEmails, error: rateError } = await supabase
      .from('email_logs')
      .select('id')
      .eq('sent_by', user.id)
      .gte('sent_at', oneHourAgo);

    if (rateError) {
      console.error("Error checking rate limit:", rateError);
    } else if (recentEmails && recentEmails.length >= RATE_LIMIT_MAX_REQUESTS) {
      throw new Error(`Rate limit exceeded: maximum ${RATE_LIMIT_MAX_REQUESTS} bulk emails per hour. Please wait before sending more.`);
    }

    // Get sender's company
    const { data: senderProfile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id, full_name, email, companies!inner(name)')
      .eq('id', user.id)
      .single();

    if (profileError || !senderProfile?.company_id) {
      throw new Error("User has no company associated");
    }

    const senderDisplayName =
      (senderProfile.full_name as string | null | undefined)?.trim() ||
      (typeof user.email === "string" ? user.email.split("@")[0] : "") ||
      "Staff";

    const companyName = (senderProfile.companies as any)?.name || 'Unknown';
    console.log(`📧 Sending from company: ${companyName}`);

    // Get company's M365 configuration
    const { data: emailConfig, error: configError } = await supabase
      .from('company_email_config')
      .select('*')
      .eq('company_id', senderProfile.company_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!emailConfig || !emailConfig.is_configured) {
      console.warn("⚠️ Email not configured for this company");
      // Continue - will skip email sending but still send in-app
    }

    // Fetch recipients by tags
    let recipientsByTag: any[] = [];
    if (recipientTags && recipientTags.length > 0) {
      const { data: taggedUsers, error: tagError } = await supabase
        .from("user_tags")
        .select("user_id, profiles!inner(id, email, full_name)")
        .in("tag", recipientTags);

      if (tagError) {
        console.error("Error fetching tagged users:", tagError);
      } else {
        recipientsByTag = taggedUsers || [];
      }
    }

    // Fetch recipients by IDs
    let recipientsByIds: any[] = [];
    if (recipientIds && recipientIds.length > 0) {
      const { data: directUsers, error: idsError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", recipientIds);

      if (idsError) {
        console.error("Error fetching users by IDs:", idsError);
      } else {
        recipientsByIds = directUsers || [];
      }
    }

    // Merge and deduplicate recipients
    const allRecipients = new Map();

    recipientsByTag.forEach((item: any) => {
      const profile = item.profiles;
      if (profile) {
        allRecipients.set(profile.id, {
          id: profile.id,
          email: profile.email || "no-email@example.com",
          full_name: profile.full_name || "Camp User",
        });
      }
    });

    recipientsByIds.forEach((profile: any) => {
      if (profile) {
        allRecipients.set(profile.id, {
          id: profile.id,
          email: profile.email || "no-email@example.com",
          full_name: profile.full_name || "Camp User",
        });
      }
    });

    const recipients = Array.from(allRecipients.values());
    
    // Enforce maximum recipients per request
    if (recipients.length > MAX_RECIPIENTS_PER_REQUEST) {
      throw new Error(`Too many recipients: maximum ${MAX_RECIPIENTS_PER_REQUEST} recipients per request. Please send in batches.`);
    }

    const emails = recipients.map((r) => r.email);

    console.log(`Prepared ${recipients.length} unique recipients`);
    console.log(`Email addresses: ${emails.join(", ")}`);

    const deliveryMethodsUsed: string[] = [];
    const batchAt = new Date().toISOString();
    const recipientIdsForLog = recipients.map((r) => r.id);

    // Log first so email_logs always exists before in-app rows (mobile RPC can repair null sender_id).
    const { data: logRow, error: preLogError } = await supabase
      .from("email_logs")
      .insert({
        sent_by: user.id,
        subject,
        recipient_count: recipients.length,
        recipient_tags: recipientTags,
        recipient_ids: recipientIdsForLog,
        delivery_methods: [],
        status: "sent",
        sent_at: batchAt,
        error_details: null,
      })
      .select("id")
      .maybeSingle();

    if (preLogError) {
      console.error("Error pre-inserting email_logs (bulk sender repair may miss this batch):", preLogError);
    }
    const bulkLogId = logRow?.id ?? null;

    // Send in-app notifications if selected
    if (deliveryMethods.inApp) {
      const messages = recipients.map(recipient => ({
        recipient_id: recipient.id,
        sender_id: user.id,
        sender_display_name: senderDisplayName,
        subject: subject,
        content: message,
        read: false,
        notification_type: 'notification',
        created_at: batchAt
      }));

      const { error: messagesError } = await supabase
        .from("messages")
        .insert(messages);

      if (messagesError) {
        console.error("Error sending in-app notifications:", messagesError);
        throw new Error(`Failed to send in-app notifications: ${messagesError.message}`);
      }

      deliveryMethodsUsed.push("in_app");
      console.log(`✓ Sent ${messages.length} in-app notifications`);
    }

    // Send email notifications if selected
    if (deliveryMethods.email) {
      if (!emailConfig || !emailConfig.is_configured) {
        console.warn("⚠️ Email sending requested but not configured for this company");
        deliveryMethodsUsed.push("email_not_configured");
      } else {
        try {
          console.log("📤 Sending emails via Microsoft 365");

          // Decrypt the client secret
          const { data: decryptedSecret, error: decryptError } = await supabase.rpc(
            "decrypt_secret",
            { encrypted: emailConfig.m365_client_secret_encrypted }
          );

          if (decryptError) {
            console.error("Failed to decrypt secret:", decryptError);
            throw new Error("Failed to decrypt credentials");
          }

          // Get access token
          const tokenResponse = await fetch(
            `https://login.microsoftonline.com/${emailConfig.m365_tenant_id}/oauth2/v2.0/token`,
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: emailConfig.m365_client_id,
                client_secret: decryptedSecret,
                scope: "https://graph.microsoft.com/.default",
                grant_type: "client_credentials",
              }),
            }
          );

          const tokenData = await tokenResponse.json();

          if (!tokenResponse.ok) {
            console.error("Failed to get access token:", tokenData);
            throw new Error("Failed to authenticate with Microsoft 365");
          }

          const accessToken = tokenData.access_token;
          let successCount = 0;
          let failCount = 0;

          // Send emails via Microsoft Graph API
          for (const recipient of recipients) {
            // Skip sending Microsoft email if user has no email address
            if (!recipient.email || recipient.email === "no-email@example.com") {
              console.log(`Skipping external email for ${recipient.full_name} - no email on file`);
              continue;
            }
            try {
              const emailPayload = {
                message: {
                  subject: subject,
                  body: {
                    contentType: "HTML",
                    content: sanitizeForEmail(message.replace(/\n/g, "<br>")),
                  },
                  from: {
                    emailAddress: {
                      address: emailConfig.m365_sender_email,
                      name: emailConfig.m365_sender_name || companyName,
                    },
                  },
                  toRecipients: [
                    {
                      emailAddress: {
                        address: recipient.email,
                        name: recipient.full_name,
                      },
                    },
                  ],
                },
              };

              const sendResponse = await fetch(
                `https://graph.microsoft.com/v1.0/users/${emailConfig.m365_sender_email}/sendMail`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(emailPayload),
                }
              );

              if (sendResponse.ok) {
                successCount++;
                console.log(`✓ Email sent to ${recipient.email}`);
              } else {
                failCount++;
                const errorData = await sendResponse.text();
                console.error(`✗ Failed to send email to ${recipient.email}:`, errorData);
              }
            } catch (emailError) {
              failCount++;
              console.error(`✗ Error sending email to ${recipient.email}:`, emailError);
            }
          }

          console.log(`📧 Email sending complete: ${successCount} success, ${failCount} failed`);
          deliveryMethodsUsed.push("email");
        } catch (error) {
          console.error("Email sending error:", error);
          deliveryMethodsUsed.push("email_failed");
        }
      }
    }

    if (bulkLogId) {
      const { error: logUpdateError } = await supabase
        .from("email_logs")
        .update({ delivery_methods: deliveryMethodsUsed })
        .eq("id", bulkLogId);
      if (logUpdateError) {
        console.error("Error updating email_logs:", logUpdateError);
      }
    } else {
      const { error: logError } = await supabase.from("email_logs").insert({
        sent_by: user.id,
        subject,
        recipient_count: recipients.length,
        recipient_tags: recipientTags,
        recipient_ids: recipientIdsForLog,
        delivery_methods: deliveryMethodsUsed,
        status: "sent",
        sent_at: batchAt,
        error_details: null,
      });
      if (logError) {
        console.error("Error logging notification:", logError);
      }
    }

    const methodsDescription = deliveryMethodsUsed.map(m => 
      m === 'in_app' ? 'in-app notification' : 'email'
    ).join(' and ');

    const responseNote = deliveryMethodsUsed.includes("email_not_configured")
      ? "In-app notifications sent. Email not configured for your company."
      : deliveryMethodsUsed.includes("email_failed")
      ? "In-app notifications sent. Email sending failed - check configuration."
      : deliveryMethodsUsed.includes("email")
      ? "Notifications sent via in-app and email."
      : "In-app notifications sent successfully.";

    return new Response(
      JSON.stringify({
        success: true,
        recipient_count: recipients.length,
        recipients: emails,
        delivery_methods: deliveryMethodsUsed,
        note: responseNote
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);