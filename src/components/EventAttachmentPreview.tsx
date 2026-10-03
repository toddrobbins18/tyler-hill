import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  eventAttachmentKind,
  resolveEventAttachmentUrl,
  type EventAttachmentKind,
} from "@/lib/eventAttachment";

type EventAttachmentPreviewProps = {
  fileUrl: string;
  fileName?: string | null;
  className?: string;
  /** Compact layout for add/edit forms */
  variant?: "default" | "form";
  onRemove?: () => void;
};

export function EventAttachmentPreview({
  fileUrl,
  fileName,
  className,
  variant = "default",
  onRemove,
}: EventAttachmentPreviewProps) {
  const isForm = variant === "form";
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const kind: EventAttachmentKind = eventAttachmentKind(fileName, fileUrl);
  const label = fileName?.trim() || "View attachment";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void resolveEventAttachmentUrl(supabase, fileUrl)
      .then((url) => {
        if (!cancelled) setResolvedUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedUrl(fileUrl);
          setError("Could not refresh attachment link");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  const openUrl = resolvedUrl || fileUrl;

  return (
    <div className={className}>
      {!isForm ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Attachment
          </p>
          {openUrl ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3 text-sm">
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-center gap-2 transition-colors hover:opacity-80"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>
        {onRemove ? (
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onRemove}>
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-muted-foreground">{error}</p> : null}

      {loading ? (
        <div
          className={
            isForm
              ? "mt-2 flex items-center justify-center gap-2 rounded-lg border bg-muted/30 py-6 text-sm text-muted-foreground"
              : "mt-3 flex items-center justify-center gap-2 rounded-lg border bg-muted/30 py-10 text-sm text-muted-foreground"
          }
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading preview…
        </div>
      ) : null}

      {!loading && openUrl && kind === "image" ? (
        <div className="mt-2 overflow-hidden rounded-lg border bg-muted/20">
          <img
            src={openUrl}
            alt={label}
            className={isForm ? "max-h-48 w-full object-contain" : "max-h-80 w-full object-contain"}
          />
        </div>
      ) : null}

      {!loading && openUrl && kind === "pdf" ? (
        <div className="mt-2 overflow-hidden rounded-lg border bg-muted/20">
          <iframe
            title={label}
            src={openUrl}
            className={
              isForm
                ? "h-48 w-full bg-white"
                : "h-[min(420px,55vh)] w-full bg-white"
            }
          />
        </div>
      ) : null}

      {!loading && resolvedUrl && kind === "other" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Preview not available for this file type. Use Open or Download above.
        </p>
      ) : null}
    </div>
  );
}
