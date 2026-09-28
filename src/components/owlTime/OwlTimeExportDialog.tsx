import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Table2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  buildOwlTimeExportBlob,
  downloadBlob,
  owlTimeExportFormatMeta,
  type OwlTimeExportFormat,
  type OwlTimeReportDataset,
} from "@/lib/owlTimeReportExport";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataset: OwlTimeReportDataset | null;
};

const FORMAT_OPTIONS: {
  id: OwlTimeExportFormat;
  icon: typeof FileSpreadsheet;
}[] = [
  { id: "csv", icon: FileSpreadsheet },
  { id: "pdf", icon: FileText },
  { id: "xlsx", icon: Table2 },
];

const PREVIEW_ROW_LIMIT = 12;

export function OwlTimeExportDialog({ open, onOpenChange, dataset }: Props) {
  const [format, setFormat] = useState<OwlTimeExportFormat>("pdf");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const exportResult = useMemo(() => {
    if (!dataset) return null;
    return buildOwlTimeExportBlob(format, dataset);
  }, [dataset, format]);

  useEffect(() => {
    if (!open) return;
    setFormat("pdf");
  }, [open, dataset?.kind, dataset?.dateLabel]);

  useEffect(() => {
    if (!open || format !== "pdf" || !exportResult) {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    const url = URL.createObjectURL(exportResult.blob);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [open, format, exportResult]);

  const previewRows = dataset?.rows.slice(0, PREVIEW_ROW_LIMIT) ?? [];
  const hiddenCount = Math.max(0, (dataset?.rows.length ?? 0) - previewRows.length);

  const handleDownload = () => {
    if (!exportResult) return;
    downloadBlob(exportResult.blob, exportResult.filename);
  };

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b px-6 pb-4 pt-6 pr-12">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle>Export {dataset?.title ?? "Report"}</DialogTitle>
            <DialogDescription>
              {dataset?.subtitle ?? "Choose a format and download your Owl Time report."}
            </DialogDescription>
          </DialogHeader>
          {dataset ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">
                {dataset.rows.length} row{dataset.rows.length !== 1 ? "s" : ""}
              </Badge>
              {dataset.meta?.map((item) => (
                <Badge key={item.label} variant="outline">
                  {item.label}: {item.value}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="space-y-2 border-b bg-muted/20 p-4 lg:border-b-0 lg:border-r">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Format
            </p>
            {FORMAT_OPTIONS.map(({ id, icon: Icon }) => {
              const meta = owlTimeExportFormatMeta(id);
              const selected = format === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFormat(id)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-background hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "rounded-md p-2",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                        {meta.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex min-h-[280px] min-w-0 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5">
              <p className="text-sm font-medium">Preview</p>
              {exportResult ? (
                <p className="truncate text-xs text-muted-foreground">{exportResult.filename}</p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden bg-muted/10">
              {!dataset || dataset.rows.length === 0 ? (
                <div className="flex h-full min-h-[240px] items-center justify-center p-6 text-sm text-muted-foreground">
                  No rows to export for the current filters.
                </div>
              ) : format === "pdf" && pdfUrl ? (
                <iframe
                  ref={iframeRef}
                  title={dataset.title}
                  src={pdfUrl}
                  className="h-full min-h-[320px] w-full bg-white"
                />
              ) : (
                <div className="h-full max-h-[420px] overflow-auto bg-background">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted">
                      <TableRow>
                        {dataset.headers.map((header) => (
                          <TableHead key={header} className="whitespace-nowrap text-xs">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex} className="whitespace-nowrap text-xs">
                              {String(cell ?? "")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {hiddenCount > 0 ? (
                    <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                      + {hiddenCount} more row{hiddenCount !== 1 ? "s" : ""} in the downloaded file
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-row items-center gap-2 border-t px-6 py-4 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="mr-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {format === "pdf" ? (
            <Button type="button" variant="outline" onClick={handlePrint} disabled={!pdfUrl}>
              <Printer className="h-4 w-4 mr-1.5" />
              Print
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={handleDownload}
            disabled={!exportResult || !dataset?.rows.length}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download {owlTimeExportFormatMeta(format).label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
