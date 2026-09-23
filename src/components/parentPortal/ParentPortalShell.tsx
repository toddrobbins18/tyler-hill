import { ReactNode, useState } from "react";
import {
  Calendar,
  Clock,
  Home,
  LogOut,
  Shield,
  UserCheck,
  Users,
  Waves,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PARENT_PORTAL_NAV,
  type ParentPortalView,
} from "@/lib/parentPortalConstants";
import { useParentPortalTheme } from "./useParentPortalTheme";

const NAV_ICONS: Record<ParentPortalView, typeof Home> = {
  home: Home,
  campers: Users,
  pickups: Calendar,
  absences: Clock,
  authorized: UserCheck,
  swim: Waves,
};

type ParentPortalShellProps = {
  campName: string;
  familyName: string;
  contactName?: string | null;
  themeColor?: string | null;
  companySlug?: string | null;
  activeView: ParentPortalView;
  onNavigate: (view: ParentPortalView) => void;
  onSignOut: () => void;
  children: ReactNode;
};

export function ParentPortalShell({
  campName,
  familyName,
  contactName,
  themeColor,
  companySlug,
  activeView,
  onNavigate,
  onSignOut,
  children,
}: ParentPortalShellProps) {
  const rootRef = useParentPortalTheme(themeColor, companySlug);

  const desktopNav = PARENT_PORTAL_NAV.filter((item) => item.id !== "swim").concat(
    PARENT_PORTAL_NAV.filter((item) => item.id === "swim"),
  );

  const [moreOpen, setMoreOpen] = useState(false);
  const mobilePrimary: ParentPortalView[] = ["home", "campers", "pickups", "absences"];
  const mobileMoreItems: ParentPortalView[] = ["authorized", "swim"];

  return (
    <div ref={rootRef} className="parent-portal min-h-screen pp-page-bg">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="pp-accent-blur-a absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl" />
        <div className="pp-accent-blur-b absolute -left-16 top-1/3 h-64 w-64 rounded-full blur-3xl" />
      </div>

      <header className="pp-header-bar relative z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="pp-brand-bg flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">{campName}</p>
              <p className="pp-text-muted truncate text-xs">
                {familyName} Family{contactName ? ` · ${contactName}` : ""}
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 lg:flex">
            {desktopNav.map((item) => {
              const Icon = NAV_ICONS[item.id];
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-200",
                    active ? "pp-nav-active" : "pp-nav-idle",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <Button variant="ghost" size="sm" onClick={onSignOut} className="pp-nav-idle shrink-0 rounded-full">
            <LogOut className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 lg:hidden md:px-6">
          {desktopNav.map((item) => {
            const Icon = NAV_ICONS[item.id];
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  active ? "pp-nav-active" : "pp-nav-idle bg-[hsl(var(--pp-bg-elevated))] shadow-sm",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-6 md:pb-10 md:pt-8">
        {children}
      </main>

      <nav className="pp-header-bar fixed inset-x-0 bottom-0 z-30 md:hidden">
        {moreOpen ? (
          <div className="border-b border-[hsl(var(--pp-border))] px-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              {mobileMoreItems.map((viewId) => {
                const item = PARENT_PORTAL_NAV.find((n) => n.id === viewId)!;
                const Icon = NAV_ICONS[viewId];
                return (
                  <button
                    key={viewId}
                    type="button"
                    onClick={() => {
                      onNavigate(viewId);
                      setMoreOpen(false);
                    }}
                    className="pp-card flex items-center gap-2 px-3 py-2.5 text-sm font-medium"
                  >
                    <Icon className="h-4 w-4 text-[hsl(var(--pp-brand))]" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="mx-auto grid max-w-lg grid-cols-5 px-2 py-2">
          {mobilePrimary.map((viewId) => {
            const item = PARENT_PORTAL_NAV.find((n) => n.id === viewId)!;
            const Icon = NAV_ICONS[viewId];
            const active = activeView === viewId;
            return (
              <button
                key={viewId}
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onNavigate(viewId);
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-[hsl(var(--pp-brand))]" : "pp-text-subtle",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-2xl transition-all",
                    active && "pp-nav-active",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.mobileLabel}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors",
              moreOpen || mobileMoreItems.includes(activeView)
                ? "text-[hsl(var(--pp-brand))]"
                : "pp-text-subtle",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-2xl transition-all",
                (moreOpen || mobileMoreItems.includes(activeView)) && "pp-nav-active",
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
