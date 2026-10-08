import MessageBody from "@/components/messages/MessageBody";
import { MessageMediaAttachment } from "@/components/messages/MessageMediaAttachment";
import type { MessageKind } from "@/lib/messageMedia";

type Props = {
  content: string;
  messageKind?: MessageKind | string | null;
  mediaStoragePath?: string | null;
  mediaMime?: string | null;
  senderId?: string | null;
  notificationType?: string | null;
  className?: string;
};

export function MessageContent({
  content,
  messageKind = "text",
  mediaStoragePath,
  mediaMime,
  senderId,
  notificationType,
  className,
}: Props) {
  const kind = (messageKind || "text") as MessageKind;

  if ((kind === "image" || kind === "video") && mediaStoragePath) {
    return (
      <MessageMediaAttachment
        kind={kind}
        storagePath={mediaStoragePath}
        mime={mediaMime}
        caption={content}
        senderId={senderId}
        notificationType={notificationType}
        className={className}
      />
    );
  }

  return (
    <MessageBody
      content={content}
      senderId={senderId}
      notificationType={notificationType}
      className={className}
    />
  );
}
