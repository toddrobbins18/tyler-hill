import { loadTransportPdfLogo, type TransportPdfLogo } from "@/lib/transportReportPdfLayout";

export type TransportPdfBranding = {
  companyName: string;
  logo: TransportPdfLogo | null;
  printedAt: Date;
};

export async function resolveTransportPdfBranding(company: {
  name?: string | null;
  logo_url?: string | null;
} | null | undefined): Promise<TransportPdfBranding> {
  const logo = await loadTransportPdfLogo(company?.logo_url);
  return {
    companyName: company?.name?.trim() || "Day Camp",
    logo,
    printedAt: new Date(),
  };
}
