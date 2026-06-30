import DOMPurify from "dompurify";

const HTML_TAG = /<[a-z][\s\S]*>/i;

export function looksLikeHtml(content: string): boolean {
  return HTML_TAG.test(content);
}

export function shouldRenderMessageAsHtml(content: string, opts?: {
  senderId?: string | null;
  notificationType?: string | null;
}): boolean {
  if (!looksLikeHtml(content)) return false;
  if (!opts?.senderId) return true;
  const t = (opts.notificationType || "").toLowerCase();
  return t === "automated" || t === "system" || t === "notification";
}

export function sanitizeMessageHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "br", "a", "span", "div"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

export function messageContentPreview(content: string, maxLen = 100): string {
  const text = looksLikeHtml(content)
    ? content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : content.trim();
  if (text.length <= maxLen) return text;
  return `${text.substring(0, maxLen)}...`;
}
