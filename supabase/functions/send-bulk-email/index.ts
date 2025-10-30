import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BulkEmailRequest {
  subject: string;
  message: string;
  recipientTags: string[];
  recipientIds: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, message, recipientTags, recipientIds }: BulkEmailRequest =
      await req.json();

    console.log("Received bulk email request:", {
      subject,
      recipientTags,
      recipientIds,
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
      if (profile && profile.email) {
        allRecipients.set(profile.id, {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
        });
      }
    });

    recipientsByIds.forEach((profile: any) => {
      if (profile && profile.email) {
        allRecipients.set(profile.id, {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
        });
      }
    });

    const recipients = Array.from(allRecipients.values());
    const emails = recipients.map((r) => r.email);

    console.log(`Prepared ${recipients.length} unique recipients`);
    console.log(`Email addresses: ${emails.join(", ")}`);

    // ============================================================
    // TODO: MICROSOFT 365 EMAIL INTEGRATION
    // ============================================================
    // You'll need to add these secrets to Lovable Cloud:
    // - MICROSOFT_TENANT_ID
    // - MICROSOFT_CLIENT_ID
    // - MICROSOFT_CLIENT_SECRET
    // 
    // Then implement Microsoft Graph API integration here:
    // 
    // 1. Get access token:
    //    POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
    //    body: {
    //      client_id: MICROSOFT_CLIENT_ID,
    //      client_secret: MICROSOFT_CLIENT_SECRET,
    //      scope: "https://graph.microsoft.com/.default",
    //      grant_type: "client_credentials"
    //    }
    //
    // 2. Send emails via Microsoft Graph API:
    //    POST https://graph.microsoft.com/v1.0/users/{sender-email}/sendMail
    //    headers: { Authorization: `Bearer ${accessToken}` }
    //    body: {
    //      message: {
    //        subject: subject,
    //        body: { contentType: "Text", content: message },
    //        toRecipients: emails.map(email => ({ emailAddress: { address: email } }))
    //      }
    //    }
    //
    // Documentation:
    // https://learn.microsoft.com/en-us/graph/api/user-sendmail
    // ============================================================

    console.log("=== EMAIL SENDING PLACEHOLDER ===");
    console.log(`Would send email to ${emails.length} recipients`);
    console.log(`Subject: ${subject}`);
    console.log(`Message preview: ${message.substring(0, 100)}...`);
    console.log(`Recipients: ${emails.join(", ")}`);
    console.log("================================");

    // Log email attempt to database
    const { error: logError } = await supabase.from("email_logs").insert({
      sent_by: user.id,
      subject,
      recipient_count: recipients.length,
      recipient_tags: recipientTags,
      recipient_ids: Array.from(allRecipients.keys()),
      status: "sent", // Change to "failed" if actual sending fails
      error_details: null,
    });

    if (logError) {
      console.error("Error logging email:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipient_count: recipients.length,
        recipients: emails,
        note: "Email logged but not sent. Microsoft 365 integration pending.",
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
