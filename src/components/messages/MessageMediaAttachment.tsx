import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createSignedMessageMediaUrl, type MessageKind } from "@/lib/messageMedia";
import MessageBody from "@/components/messages/MessageBody";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  kind: MessageKind;
  storagePath: string;
  mime?: string | null;
  fileName?: string | null;
  caption?: string;
  className?: string;
  senderId?: string | null;
  notificationType?: string | null;
};

export function MessageMediaAttachment({
  kind,
  storagePath,
  mime,
  fileName,
  caption,
  className,
  senderId,
  notificationType,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void createSignedMessageMediaUrl(supabase, storagePath).then((signed) => {
      if (cancelled) return;
      setUrl(signed);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-xs opacity-80", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading attachment…
      </div>
    );
  }

  if (!url) {
    return <p className={cn("text-xs text-destructive", className)}>Could not load attachment.</p>;
  }

  const displayName = fileName?.trim() || "Download file";

  return (
    <div className={cn("space-y-2", className)}>
      {kind === "image" ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block max-w-sm">
          <img
            src={url}
            alt={caption?.trim() || "Shared photo"}
            className="rounded-lg border max-h-72 w-auto object-contain bg-background"
            loading="lazy"
          />
        </a>
      ) : null}
      {kind === "video" ? (
        <video
          controls
          playsInline
          preload="metadata"
          className="max-w-full max-h-80 rounded-lg border bg-black"
          aria-label={caption?.trim() || "Shared video"}
        >
          <source src={url} type={mime || "video/mp4"} />
          Your browser does not support video playback.
        </video>
      ) : null}
      {kind === "audio" ? (
        <audio controls preload="metadata" className="w-full max-w-md" aria-label={caption?.trim() || "Shared audio"}>
          <source src={url} type={mime || "audio/mpeg"} />
          Your browser does not support audio playback.
        </audio>
      ) : null}
      {kind === "file" ? (
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer" download={displayName}>
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate max-w-[240px]">{displayName}</span>
            <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </a>
        </Button>
      ) : null}
      {caption?.trim() ? (
        <MessageBody
          content={caption}
          senderId={senderId}
          notificationType={notificationType}
          className="opacity-90"
        />
      ) : null}
    </div>
  );
}
