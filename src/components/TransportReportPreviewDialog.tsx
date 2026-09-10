import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer } from "lucide-react";

export type TransportReportPreview = {
  open: boolean;
  title: string;
  description?: string;
  kind: "pdf" | "csv";
  blob: Blob;
  filename: string;
  rows?: (string | number)[][];
};

type Props = {
  preview: TransportReportPreview | null;
  onOpenChange: (open: boolean) => void;
};

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TransportReportPreviewDialog({ preview, onOpenChange }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!preview?.open || preview.kind !== "pdf") {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    const url = URL.createObjectURL(preview.blob);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview?.open, preview?.kind, preview?.blob]);

  const handleDownload = () => {
    if (!preview) return;
    triggerBlobDownload(preview.blob, preview.filename);
  };

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  const headers = preview?.rows?.[0]?.map(String) ?? [];
  const dataRows = preview?.rows?.slice(1) ?? [];

  return (
    <Dialog open={!!preview?.open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col gap-3 p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>{preview?.title ?? "Report preview"}</DialogTitle>
          {preview?.description ? (
            <DialogDescription>{preview.description}</DialogDescription>
          ) : (
            <DialogDescription>
              Review the report in Nest, then download or print when ready.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-md border border-border overflow-hidden bg-muted/20">
          {preview?.kind === "pdf" && pdfUrl ? (
            <iframe
              ref={iframeRef}
              title={preview.title}
              src={pdfUrl}
              className="w-full h-full bg-white"
            />
          ) : null}

          {preview?.kind === "csv" ? (
            <div className="h-full overflow-auto bg-background">
              {headers.length ? (
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted">
                    <TableRow>
                      {headers.map((header, i) => (
                        <TableHead key={`${header}-${i}`} className="whitespace-nowrap text-xs">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataRows.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex} className="text-xs whitespace-nowrap">
                            {String(cell ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">No data in this report.</p>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {preview?.kind === "pdf" ? (
            <Button type="button" variant="outline" onClick={handlePrint} disabled={!pdfUrl}>
              <Printer className="h-4 w-4 mr-1.5" />
              Print
            </Button>
          ) : null}
          <Button type="button" onClick={handleDownload} disabled={!preview}>
            <Download className="h-4 w-4 mr-1.5" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
