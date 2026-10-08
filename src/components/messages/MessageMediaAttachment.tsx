import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createSignedMessageMediaUrl, type MessageKind } from "@/lib/messageMedia";
import MessageBody from "@/components/messages/MessageBody";
import { cn } from "@/lib/utils";

type Props = {
  kind: MessageKind;
  storagePath: string;
  mime?: string | null;
  caption?: string;
  className?: string;
  senderId?: string | null;
  notificationType?: string | null;
};

export function MessageMediaAttachment({
  kind,
  storagePath,
  mime,
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
        Loading media…
      </div>
    );
  }

  if (!url) {
    return <p className={cn("text-xs text-destructive", className)}>Could not load media.</p>;
  }

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
      ) : (
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
      )}
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
