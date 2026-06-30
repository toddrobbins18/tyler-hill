import { cn } from "@/lib/utils";
import {
  sanitizeMessageHtml,
  shouldRenderMessageAsHtml,
} from "@/lib/messageContentUtils";

interface MessageBodyProps {
  content: string;
  className?: string;
  senderId?: string | null;
  notificationType?: string | null;
}

export default function MessageBody({
  content,
  className,
  senderId,
  notificationType,
}: MessageBodyProps) {
  const renderHtml = shouldRenderMessageAsHtml(content, { senderId, notificationType });

  if (renderHtml) {
    return (
      <div
        className={cn(
          "text-sm prose prose-sm dark:prose-invert max-w-none",
          "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-0 [&_h2]:mb-2",
          "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1",
          "[&_ul]:my-2 [&_ul]:pl-5 [&_li]:my-0.5",
          className
        )}
        dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(content) }}
      />
    );
  }

  return <p className={cn("text-sm whitespace-pre-wrap", className)}>{content}</p>;
}
