import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type M365SendParams = {
  subject: string;
  html: string;
  to: string;
  fromName?: string;
  attachments?: Array<{ name: string; contentType: string; contentBytes: string }>;
};

export type M365SendOutcome =
  | { configured: false }
  | { configured: true; sent: true }
  | { configured: true; sent: false; error: string };

export async function trySendM365Email(
  supabase: SupabaseClient,
  companyId: string,
  params: M365SendParams,
): Promise<M365SendOutcome> {
  const { data: emailConfig } = await supabase
    .from("company_email_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!emailConfig?.is_configured || emailConfig?.is_active === false) {
    return { configured: false };
  }

  const { data: decryptedSecret, error: decryptError } = await supabase.rpc("decrypt_secret", {
    encrypted: emailConfig.m365_client_secret_encrypted,
  });
  if (decryptError || !decryptedSecret) {
    return { configured: true, sent: false, error: "Failed to decrypt email credentials" };
  }

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
    },
  );

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData?.access_token) {
    return { configured: true, sent: false, error: "Failed to authenticate with Microsoft 365" };
  }

  const campName = params.fromName ?? "North Shore Day Camp";
  const message: Record<string, unknown> = {
    subject: params.subject,
    body: { contentType: "HTML", content: params.html },
    from: {
      emailAddress: {
        address: emailConfig.m365_sender_email,
        name: emailConfig.m365_sender_name || campName,
      },
    },
    toRecipients: [{ emailAddress: { address: params.to } }],
  };

  if (params.attachments?.length) {
    message.attachments = params.attachments.map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.name,
      contentType: a.contentType,
      contentBytes: a.contentBytes,
    }));
  }

  const sendResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${emailConfig.m365_sender_email}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    },
  );

  if (!sendResponse.ok) {
    const detail = await sendResponse.text();
    console.error("M365 send failed", detail);
    return { configured: true, sent: false, error: "Failed to send email" };
  }

  return { configured: true, sent: true };
}
