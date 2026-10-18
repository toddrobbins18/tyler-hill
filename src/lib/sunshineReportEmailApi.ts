import { supabase } from "@/integrations/supabase/client";

export type SendSunshineReportsResult =
  | {
      success: true;
      sent: number;
      results: Array<
        | { camper_id: string; status: "sent"; recipient: string; subject: string }
        | { camper_id: string; status: "skipped"; reason: string }
        | { camper_id: string; status: "failed"; error: string }
      >;
    }
  | { success: false; error: string };

export type SunshineEmailPreview = {
  camper_id: string;
  camper_name: string;
  recipient: string | null;
  subject: string;
  html: string;
  imageBase64: string;
  renderedImage?: boolean;
  status: "ok";
};

export type PreviewSunshineReportsResult =
  | { success: true; previews: SunshineEmailPreview[] }
  | { success: false; error: string };

export async function previewSunshineReports(params: {
  companyId: string;
  reportDate: string;
  camperIds: string[];
}): Promise<PreviewSunshineReportsResult> {
  const { data, error } = await supabase.functions.invoke("send-sunshine-reports", {
    body: {
      company_id: params.companyId,
      report_date: params.reportDate,
      camper_ids: params.camperIds,
      preview: true,
    },
  });

  if (error) {
    return { success: false, error: error.message || "Failed to preview sunshine reports" };
  }

  if (!data?.success) {
    return { success: false, error: String(data?.error ?? "Failed to preview sunshine reports") };
  }

  const previews = (Array.isArray(data.previews) ? data.previews : []).filter(
    (p: { status?: string }) => p.status === "ok",
  ) as SunshineEmailPreview[];

  return { success: true, previews };
}

export async function sendSunshineReports(params: {
  companyId: string;
  reportDate: string;
  camperIds: string[];
}): Promise<SendSunshineReportsResult> {
  const { data, error } = await supabase.functions.invoke("send-sunshine-reports", {
    body: {
      company_id: params.companyId,
      report_date: params.reportDate,
      camper_ids: params.camperIds,
      preview: false,
    },
  });

  if (error) {
    return { success: false, error: error.message || "Failed to send sunshine reports" };
  }

  if (!data?.success) {
    return { success: false, error: String(data?.error ?? "Failed to send sunshine reports") };
  }

  return {
    success: true,
    sent: Number(data.sent ?? 0),
    results: Array.isArray(data.results) ? data.results : [],
  };
}
