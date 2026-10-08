import { useRef, useState } from "react";
import { ImageIcon, Paperclip, VideoIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  MESSAGE_IMAGE_MIME_TYPES,
  MESSAGE_VIDEO_MIME_TYPES,
  validateMessageMediaFile,
} from "@/lib/messageMedia";

type Props = {
  disabled?: boolean;
  onPick: (file: File) => void;
  uploading?: boolean;
  uploadProgress?: number;
  onCancelUpload?: () => void;
};

export function MessageMediaComposer({
  disabled,
  onPick,
  uploading,
  uploadProgress = 0,
  onCancelUpload,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = [...MESSAGE_IMAGE_MIME_TYPES, ...MESSAGE_VIDEO_MIME_TYPES].join(",");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validation = validateMessageMediaFile(file);
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    onPick(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          aria-label="Attach photo or video"
          disabled={disabled || uploading}
          onChange={handleChange}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={disabled || uploading}
          title="Attach photo or video (sandbox training)"
          aria-label="Attach photo or video"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 hidden sm:inline-flex"
          disabled={disabled || uploading}
          title="Photo"
          aria-label="Attach photo"
          onClick={() => inputRef.current?.click()}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 hidden sm:inline-flex"
          disabled={disabled || uploading}
          title="Video"
          aria-label="Attach video"
          onClick={() => inputRef.current?.click()}
        >
          <VideoIcon className="h-4 w-4" />
        </Button>
      </div>
      {uploading ? (
        <div className="rounded-md border bg-muted/40 p-2 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Uploading media…</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <Progress value={uploadProgress} className="h-1.5" />
          {onCancelUpload ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onCancelUpload}>
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
