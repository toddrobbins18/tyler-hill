/** Browser capture helpers for Nest message composer. */

function pickViaInput(accept: string, capture?: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    if (capture) input.setAttribute("capture", capture);
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      document.body.removeChild(input);
      resolve(file);
    };
    input.click();
  });
}

export function pickPhotoFromLibrary(): Promise<File | null> {
  return pickViaInput("image/*");
}

export function pickPhotoCapture(): Promise<File | null> {
  return pickViaInput("image/*", "environment");
}

export function pickVideoFromLibrary(): Promise<File | null> {
  return pickViaInput("video/*");
}

export function pickVideoCapture(): Promise<File | null> {
  return pickViaInput("video/*", "environment");
}

export function pickAnyAttachment(): Promise<File | null> {
  return pickViaInput(
    "image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv",
  );
}

function pickRecorderMime(candidates: string[]): string | undefined {
  return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}

export type WebRecordingSession = {
  stop: () => Promise<File | null>;
  cancel: () => void;
};

export async function startVoiceRecordingSession(): Promise<WebRecordingSession | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime =
    pickRecorderMime(["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) ?? "";
  const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start(250);

  const cleanup = () => stream.getTracks().forEach((t) => t.stop());

  return {
    cancel: () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* ignore */
      }
      cleanup();
    },
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          cleanup();
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          if (!blob.size) {
            resolve(null);
            return;
          }
          const ext = blob.type.includes("mp4") ? "m4a" : "webm";
          resolve(new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || "audio/webm" }));
        };
        if (recorder.state !== "inactive") recorder.stop();
        else resolve(null);
      }),
  };
}

export async function startVideoRecordingSession(): Promise<(WebRecordingSession & { previewStream: MediaStream }) | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  const mime =
    pickRecorderMime(["video/webm;codecs=vp9", "video/webm", "video/mp4"]) ?? "";
  const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(250);

  const cleanup = () => stream.getTracks().forEach((t) => t.stop());

  return {
    previewStream: stream,
    cancel: () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* ignore */
      }
      cleanup();
    },
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          cleanup();
          const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
          if (!blob.size) {
            resolve(null);
            return;
          }
          const ext = blob.type.includes("mp4") ? "mp4" : "webm";
          resolve(new File([blob], `video-${Date.now()}.${ext}`, { type: blob.type || "video/webm" }));
        };
        if (recorder.state !== "inactive") recorder.stop();
        else resolve(null);
      }),
  };
}
