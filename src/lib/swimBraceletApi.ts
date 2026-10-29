import { supabase } from "@/integrations/supabase/client";

export type SendSwimBraceletEmailResult =
  | {
      success: true;
      sent: boolean;
      preview: boolean;
      recipient: string;
      subject: string;
      html?: string;
    }
  | { success: false; error: string };

export async function sendSwimBraceletEmail(params: {
  companyId: string;
  childId: string;
  season: string;
  preview?: boolean;
}): Promise<SendSwimBraceletEmailResult> {
  const { data, error } = await supabase.functions.invoke("send-swim-bracelet-email", {
    body: {
      company_id: params.companyId,
      child_id: params.childId,
      season: params.season,
      preview: params.preview === true,
    },
  });

  if (error) {
    return { success: false, error: error.message || "Failed to send swim bracelet email" };
  }

  if (!data?.success) {
    return { success: false, error: String(data?.error ?? "Failed to send swim bracelet email") };
  }

  return {
    success: true,
    sent: Boolean(data.sent),
    preview: Boolean(data.preview),
    recipient: String(data.recipient ?? ""),
    subject: String(data.subject ?? ""),
    html: typeof data.html === "string" ? data.html : undefined,
  };
}
