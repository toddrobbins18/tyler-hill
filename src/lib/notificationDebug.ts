/**
 * Console traces for in-app notification flow (compose → edge fn → DB → recipient Realtime).
 * - Local dev: always on when `import.meta.env.DEV` is true.
 * - Production build: set `VITE_NOTIFICATION_DEBUG=true` in `.env` to enable.
 */
const notificationsDebugEnabled =
  import.meta.env.DEV === true ||
  String(import.meta.env.VITE_NOTIFICATION_DEBUG ?? "").toLowerCase() === "true";

export function notificationsDebug(...args: unknown[]): void {
  if (!notificationsDebugEnabled) return;
  console.log("[Nest:Notifications]", ...args);
}
