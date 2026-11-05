import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, Loader2, Pause, Play, X } from "lucide-react";
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

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ChatVideoBubble({ url, label }: { url: string; label: string }) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);

  const src = `${url}#t=0.1`;

  const onPreviewMeta = () => {
    const el = previewRef.current;
    if (!el) return;
    if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
    if (el.currentTime < 0.05) el.currentTime = 0.1;
  };

  const close = () => {
    playerRef.current?.pause();
    setPlaying(false);
    setOpen(false);
  };

  const togglePlay = () => {
    const el = playerRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        playerRef.current?.pause();
        setPlaying(false);
        setOpen(false);
        return;
      }
      if (event.key !== " ") return;
      event.preventDefault();
      const el = playerRef.current;
      if (!el) return;
      if (el.paused) {
        void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        el.pause();
        setPlaying(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = playerRef.current;
    if (!el) return;
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative block w-[240px] max-w-full overflow-hidden rounded-[1.05rem] bg-black"
        aria-label={label}
      >
        <video
          ref={previewRef}
          src={src}
          muted
          playsInline
          preload="metadata"
          className="h-[210px] w-full object-cover"
          onLoadedMetadata={onPreviewMeta}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 shadow-lg ring-2 ring-white/70">
            <Play className="ml-0.5 h-7 w-7 fill-white text-white" />
          </span>
        </span>
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
          {duration != null ? formatDuration(duration) : "Video"}
        </span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex flex-col bg-black">
              <div className="flex items-center justify-between px-3 py-2 text-white">
                <button
                  type="button"
                  onClick={close}
                  className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="h-6 w-6" />
                </button>
                <span className="text-sm font-medium">Video</span>
                <span className="w-10" />
              </div>
              <button
                type="button"
                className="relative flex min-h-0 flex-1 items-center justify-center"
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
              >
                <video
                  ref={playerRef}
                  src={url}
                  playsInline
                  className="max-h-full max-w-full"
                  onEnded={() => setPlaying(false)}
                />
                {!playing ? (
                  <span className="pointer-events-none absolute flex h-16 w-16 items-center justify-center rounded-full bg-black/50 ring-2 ring-white/80">
                    <Play className="ml-1 h-8 w-8 fill-white text-white" />
                  </span>
                ) : (
                  <span className="pointer-events-none absolute opacity-0 hover:opacity-100">
                    <Pause className="h-10 w-10 text-white" />
                  </span>
                )}
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

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
  const visual = kind === "image" || kind === "video";

  return (
    <div className={cn(visual ? "-mx-2.5 -mt-1.5 space-y-2" : "space-y-2", className)}>
      {kind === "image" ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-[1.05rem]">
          <img
            src={url}
            alt={caption?.trim() || "Shared photo"}
            className="max-h-72 w-[240px] max-w-full object-cover"
            loading="lazy"
          />
        </a>
      ) : null}
      {kind === "video" ? (
        <ChatVideoBubble url={url} label={caption?.trim() || "Shared video"} />
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
          className={cn("opacity-90", visual && "px-2.5")}
        />
      ) : null}
    </div>
  );
}
