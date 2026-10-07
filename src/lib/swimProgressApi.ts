import { supabase } from "@/integrations/supabase/client";
import type { SwimProgressReportLevel } from "@/lib/swimProgressSkills";

export type SendSwimProgressEmailResult =
  | { success: true; recipient: string; subject: string; pdfAttached: boolean }
  | { success: false; error: string };

export async function sendSwimProgressEmail(params: {
  companyId: string;
  childId: string;
  season: string;
  levelId: SwimProgressReportLevel;
  pdfBase64?: string;
  pdfFilename?: string;
}): Promise<SendSwimProgressEmailResult> {
  const { data, error } = await supabase.functions.invoke("send-swim-progress-email", {
    body: {
      company_id: params.companyId,
      child_id: params.childId,
      season: params.season,
      level_id: params.levelId,
      pdf_base64: params.pdfBase64,
      pdf_filename: params.pdfFilename,
    },
  });

  if (error) {
    return { success: false, error: error.message || "Failed to send swim progress email" };
  }

  if (!data?.success) {
    return { success: false, error: String(data?.error ?? "Failed to send swim progress email") };
  }

  return {
    success: true,
    recipient: String(data.recipient),
    subject: String(data.subject),
    pdfAttached: Boolean(data.pdfAttached),
  };
}
