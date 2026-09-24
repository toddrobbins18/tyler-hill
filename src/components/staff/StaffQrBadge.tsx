import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { staffQrPayload } from "@/lib/staffQrCode";
import { Download, Printer } from "lucide-react";

type Props = {
  staffName: string;
  qrToken: string;
};

export function StaffQrBadge({ staffName, qrToken }: Props) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    void QRCode.toDataURL(staffQrPayload(qrToken), {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
    }).then(setDataUrl);
  }, [qrToken]);

  const downloadBadge = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${staffName.replace(/\s+/g, "-")}-qr.png`;
    a.click();
  };

  const printBadge = () => {
    if (!dataUrl) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>${staffName} QR</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:24px">
        <h2>${staffName}</h2>
        <img src="${dataUrl}" width="220" height="220" />
        <p style="font-size:12px;color:#666">Scan at Staff Time Clock</p>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
      {dataUrl ? (
        <img src={dataUrl} alt={`QR code for ${staffName}`} className="rounded-md bg-white p-2" />
      ) : (
        <div className="h-[220px] w-[220px] animate-pulse rounded-md bg-muted" />
      )}
      <p className="text-xs text-muted-foreground font-mono break-all">{staffQrPayload(qrToken)}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={downloadBadge}>
          <Download className="h-4 w-4 mr-1" /> Download
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={printBadge}>
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
      </div>
    </div>
  );
}
