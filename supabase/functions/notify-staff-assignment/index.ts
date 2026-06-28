import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StaffAssignmentRequest {
  staffNames: string[];
  eventTitle: string;
  eventDate: string;
  eventType: string; // "activity", "special_event", "trip"
  companyId: string;
  assignedBy?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      staffNames,
      eventTitle,
      eventDate,
      eventType,
      companyId,
    }: StaffAssignmentRequest = await req.json();

    if (!staffNames?.length || !eventTitle || !companyId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`📋 Staff assignment notification: ${staffNames.length} staff for "${eventTitle}"`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the assigning user's name and ID from auth token
    let assignedByName = "An administrator";
    let assignedByUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        assignedByUserId = user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.full_name) {
          assignedByName = profile.full_name;
        }
      }
    }

    // Look up staff members by name to find their linked user profiles
    const { data: staffRecords, error: staffError } = await supabase
      .from("staff")
      .select("id, name, user_id")
      .eq("company_id", companyId)
      .in("name", staffNames);

    if (staffError) {
      console.error("Error fetching staff:", staffError);
      throw new Error("Failed to look up staff members");
    }

    if (!staffRecords?.length) {
      console.log("No matching staff records found");
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: "No matching staff found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const eventTypeLabel = eventType === "activity" ? "Activity/Field Trip"
      : eventType === "special_event" ? "Special Event/Evening Activity"
      : "Trip";

    const formattedDate = new Date(eventDate + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const subject = `Staff Assignment: ${eventTitle}`;
    const content = `You have been assigned to the following ${eventTypeLabel}:\n\n` +
      `📌 Event: ${eventTitle}\n` +
      `📅 Date: ${formattedDate}\n` +
      `👤 Assigned by: ${assignedByName}\n\n` +
      `Please check the ${eventTypeLabel} page for full details.`;

    // Collect user IDs for in-app messages
    const userIdsToNotify: string[] = [];
    const emailsToNotify: { email: string; name: string }[] = [];

    for (const staff of staffRecords) {
      if (staff.user_id) {
        userIdsToNotify.push(staff.user_id);
        // Get email for this user
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", staff.user_id)
          .maybeSingle();
        if (profile?.email) {
          emailsToNotify.push({ email: profile.email, name: profile.full_name || staff.name });
        }
      }
    }

    let inAppCount = 0;
    let emailCount = 0;

    // 1. Send in-app messages
    if (userIdsToNotify.length > 0) {
      const messages = userIdsToNotify.map((userId) => ({
        recipient_id: userId,
        sender_id: assignedByUserId,
        subject,
        content,
        read: false,
        company_id: companyId,
      }));

      const { error: msgError } = await supabase.from("messages").insert(messages);
      if (msgError) {
        console.error("Error sending in-app messages:", msgError);
      } else {
        inAppCount = messages.length;
        console.log(`✓ Sent ${inAppCount} in-app notifications`);
      }
    }

    // 2. Send email via M365 if configured
    if (emailsToNotify.length > 0) {
      const { data: emailConfig } = await supabase
        .from("company_email_config")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (emailConfig?.is_configured && emailConfig?.is_active !== false) {
        try {
          const { data: decryptedSecret, error: decryptError } = await supabase.rpc(
            "decrypt_secret",
            { encrypted: emailConfig.m365_client_secret_encrypted }
          );

          if (decryptError) throw new Error("Failed to decrypt M365 credentials");

          // Get M365 access token
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
          if (!tokenResponse.ok) throw new Error("M365 auth failed");

          const accessToken = tokenData.access_token;

          // Get company name for email sender
          const { data: company } = await supabase
            .from("companies")
            .select("name")
            .eq("id", companyId)
            .maybeSingle();

          const htmlContent = content.replace(/\n/g, "<br>");

          for (const recipient of emailsToNotify) {
            try {
              const sendResponse = await fetch(
                `https://graph.microsoft.com/v1.0/users/${emailConfig.m365_sender_email}/sendMail`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    message: {
                      subject,
                      body: { contentType: "HTML", content: htmlContent },
                      from: {
                        emailAddress: {
                          address: emailConfig.m365_sender_email,
                          name: emailConfig.m365_sender_name || company?.name || "Camp",
                        },
                      },
                      toRecipients: [{
                        emailAddress: { address: recipient.email, name: recipient.name },
                      }],
                    },
                  }),
                }
              );

              if (sendResponse.ok) {
                emailCount++;
                console.log(`✓ Email sent to ${recipient.email}`);
              } else {
                console.error(`✗ Email failed for ${recipient.email}:`, await sendResponse.text());
              }
            } catch (emailErr) {
              console.error(`✗ Email error for ${recipient.email}:`, emailErr);
            }
          }
        } catch (err) {
          console.warn("⚠️ Email sending failed, in-app notifications still sent:", err);
        }
      } else {
        console.log("ℹ️ Email not configured, skipping email notifications");
      }
    }

    console.log(`📧 Done: ${inAppCount} in-app, ${emailCount} emails sent`);

    return new Response(
      JSON.stringify({
        success: true,
        in_app_count: inAppCount,
        email_count: emailCount,
        staff_notified: staffRecords.map((s) => s.name),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-staff-assignment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
