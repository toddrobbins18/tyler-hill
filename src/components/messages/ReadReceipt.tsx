import { Check, CheckCheck } from "lucide-react";
import { getReadReceiptLabel, type ReadReceiptFields } from "@/lib/messageReadReceipts";
import { cn } from "@/lib/utils";

type Props = {
  message: ReadReceiptFields;
  className?: string;
  showIcon?: boolean;
  /** Chat bubble: ✓ grey = sent/delivered, ✓✓ blue = read (WhatsApp-style). No text. */
  whatsapp?: boolean;
  /** @deprecated use whatsapp */
  compact?: boolean;
};

export function ReadReceipt({ message, className, showIcon = true, whatsapp, compact }: Props) {
  const read = message.read === true;
  const Icon = read ? CheckCheck : Check;
  const wa = whatsapp ?? compact;

  if (wa) {
    return (
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          read ? "text-sky-500" : "text-muted-foreground/75",
          className,
        )}
        aria-label={read ? "Read" : "Delivered"}
      />
    );
  }

  const label = getReadReceiptLabel(message);
  if (!label) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      {showIcon ? (
        <Icon className={cn("h-3.5 w-3.5 shrink-0", read ? "text-sky-500" : "text-muted-foreground")} aria-hidden />
      ) : null}
      <span>{label}</span>
    </span>
  );
}
