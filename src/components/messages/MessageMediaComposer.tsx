import { useRef, useState } from "react";
import { Camera, ImageIcon, Mic, Paperclip, Square, VideoIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { validateMessageMediaFile } from "@/lib/messageMedia";
import {
  pickAnyAttachment,
  pickPhotoCapture,
  pickPhotoFromLibrary,
  pickVideoCapture,
  pickVideoFromLibrary,
  startVideoRecordingSession,
  startVoiceRecordingSession,
  type WebRecordingSession,
} from "@/lib/webMessageMediaCapture";

type Props = {
  disabled?: boolean;
  onPick: (file: File) => void;
  uploading?: boolean;
  uploadProgress?: number;
  onCancelUpload?: () => void;
  /** Inline: attach buttons beside the text field (DM thread). */
  variant?: "stack" | "inline";
};

function deliverFile(file: File | null, onPick: (file: File) => void) {
  if (!file) return;
  const validation = validateMessageMediaFile(file);
  if (!validation.ok) {
    toast.error(validation.error);
    return;
  }
  onPick(file);
}

export function MessageMediaComposer({
  disabled,
  onPick,
  uploading,
  uploadProgress = 0,
  onCancelUpload,
  variant = "stack",
}: Props) {
  const [voiceSession, setVoiceSession] = useState<WebRecordingSession | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoSession, setVideoSession] = useState<
    (WebRecordingSession & { previewStream: MediaStream }) | null
  >(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const busy = disabled || uploading || !!voiceSession;

  const startVoice = async () => {
    if (voiceSession) {
      const file = await voiceSession.stop();
      setVoiceSession(null);
      deliverFile(file, onPick);
      return;
    }
    try {
      const session = await startVoiceRecordingSession();
      if (!session) {
        toast.error("Microphone access is not available in this browser.");
        return;
      }
      setVoiceSession(session);
      toast.message("Recording voice… Click the mic again to send.");
    } catch {
      toast.error("Could not access microphone.");
    }
  };

  const cancelVoice = () => {
    voiceSession?.cancel();
    setVoiceSession(null);
  };

  const openVideoDialog = async () => {
    try {
      const session = await startVideoRecordingSession();
      if (!session) {
        toast.error("Camera access is not available in this browser.");
        return;
      }
      setVideoSession(session);
      setVideoOpen(true);
      requestAnimationFrame(() => {
        const el = videoPreviewRef.current;
        if (el) {
          el.srcObject = session.previewStream;
          void el.play().catch(() => undefined);
        }
      });
    } catch {
      toast.error("Could not access camera.");
    }
  };

  const finishVideo = async () => {
    if (!videoSession) return;
    const file = await videoSession.stop();
    setVideoSession(null);
    setVideoOpen(false);
    deliverFile(file, onPick);
  };

  const cancelVideo = () => {
    videoSession?.cancel();
    setVideoSession(null);
    setVideoOpen(false);
  };

  const attachButtons = (
    <div className="flex items-center gap-0.5 shrink-0 flex-wrap">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={busy}
        title="Attach file"
        aria-label="Attach file"
        onClick={() => void pickAnyAttachment().then((f) => deliverFile(f, onPick))}
      >
        <Paperclip className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={busy}
        title="Photo library"
        aria-label="Photo library"
        onClick={() => void pickPhotoFromLibrary().then((f) => deliverFile(f, onPick))}
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={busy}
        title="Take photo"
        aria-label="Take photo"
        onClick={() => void pickPhotoCapture().then((f) => deliverFile(f, onPick))}
      >
        <Camera className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        disabled={busy}
        title="Video library or camera clip"
        aria-label="Attach video"
        onClick={() =>
          void pickVideoCapture()
            .then((f) => f ?? pickVideoFromLibrary())
            .then((f) => deliverFile(f, onPick))
        }
      >
        <VideoIcon className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-9 w-9 shrink-0 ${voiceSession ? "text-destructive" : ""}`}
        disabled={disabled || uploading}
        title={voiceSession ? "Stop and send voice" : "Record voice"}
        aria-label={voiceSession ? "Stop voice recording" : "Record voice"}
        onClick={() => void startVoice()}
      >
        {voiceSession ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
      </Button>
      {voiceSession ? (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={cancelVoice}>
          Cancel
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 hidden md:inline-flex"
        disabled={busy}
        title="Record video (webcam)"
        aria-label="Record video with webcam"
        onClick={() => void openVideoDialog()}
      >
        <VideoIcon className="h-4 w-4 text-primary" />
      </Button>
    </div>
  );

  const uploadBlock =
    uploading ? (
      <div className="rounded-md border bg-muted/40 p-2 space-y-1 w-full">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Uploading…</span>
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
    ) : null;

  const videoDialog = (
    <Dialog open={videoOpen} onOpenChange={(open) => !open && cancelVideo()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record video</DialogTitle>
        </DialogHeader>
        <video ref={videoPreviewRef} className="w-full rounded-lg bg-black max-h-[50vh]" muted playsInline />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={cancelVideo}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void finishVideo()}>
            Stop & attach
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (variant === "inline") {
    return (
      <>
        {attachButtons}
        {videoDialog}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {attachButtons}
      {uploadBlock}
      {videoDialog}
    </div>
  );
}
