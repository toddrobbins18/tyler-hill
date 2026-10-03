import { ReactNode, useState } from "react";
import {
  Calendar,
  Clock,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  Shield,
  UserCheck,
  Users,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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

type SidebarPanelProps = {
  campName: string;
  familyName: string;
  firstName?: string;
  activeView: ParentPortalView;
  onNavigate: (view: ParentPortalView) => void;
  onSignOut: () => void;
  onNavSelect?: () => void;
  className?: string;
};

function SidebarPanel({
  campName,
  familyName,
  firstName,
  activeView,
  onNavigate,
  onSignOut,
  onNavSelect,
  className,
}: SidebarPanelProps) {
  const handleNavigate = (view: ParentPortalView) => {
    onNavigate(view);
    onNavSelect?.();
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex flex-col gap-6 px-5 py-6">
        <div className="flex items-start gap-3 border-b border-[hsl(var(--pp-border))] pb-5">
          <div className="pp-brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Shield className="h-4 w-4" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="truncate text-sm font-semibold leading-tight tracking-tight">{campName}</p>
            <p className="pp-text-muted mt-0.5 truncate text-xs leading-snug">
              {familyName} Family
              {firstName ? ` · ${firstName}` : ""}
            </p>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 pt-1" aria-label="Family portal">
          {PARENT_PORTAL_NAV.map((item) => {
            const Icon = NAV_ICONS[item.id];
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={cn(
                  "pp-sidebar-link flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[0.8125rem] font-medium transition-colors",
                  active ? "pp-sidebar-link-active" : "pp-sidebar-link-idle",
                )}
              >
                <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t px-5 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onNavSelect?.();
            onSignOut();
          }}
          className="pp-sidebar-link-idle h-9 w-full justify-start rounded-lg px-3 text-[0.8125rem] font-medium"
        >
          <LogOut className="mr-2.5 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

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

  const [moreOpen, setMoreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mobilePrimary: ParentPortalView[] = ["home", "campers", "pickups", "absences"];
  const mobileMoreItems: ParentPortalView[] = ["authorized", "swim"];

  const firstName = contactName?.trim().split(/\s+/)[0];
  const activeLabel = PARENT_PORTAL_NAV.find((item) => item.id === activeView)?.label ?? "Home";

  return (
    <div ref={rootRef} className="parent-portal min-h-screen pp-page-bg">
      {/* Desktop sidebar — fixed from lg up */}
      <aside className="pp-sidebar fixed inset-y-0 left-0 z-30 hidden w-[17.5rem] flex-col border-r lg:flex">
        <SidebarPanel
          campName={campName}
          familyName={familyName}
          firstName={firstName}
          activeView={activeView}
          onNavigate={onNavigate}
          onSignOut={onSignOut}
        />
      </aside>

      {/* Tablet / mobile drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="pp-sidebar w-[min(100vw-3rem,17.5rem)] border-r p-0 sm:max-w-[17.5rem]"
        >
          <SheetTitle className="sr-only">Family portal menu</SheetTitle>
          <SidebarPanel
            campName={campName}
            familyName={familyName}
            firstName={firstName}
            activeView={activeView}
            onNavigate={onNavigate}
            onSignOut={onSignOut}
            onNavSelect={() => setDrawerOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-screen flex-col lg:pl-[17.5rem]">
        {/* Mobile / tablet header */}
        <header className="pp-header-bar sticky top-0 z-20 lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDrawerOpen(true)}
                className="shrink-0 rounded-xl"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{activeLabel}</p>
                <p className="pp-text-muted truncate text-xs">{campName}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onSignOut} className="shrink-0 rounded-xl">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-5 md:max-w-5xl md:px-8 md:pb-10 md:pt-8 lg:max-w-6xl lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="pp-tab-bar fixed inset-x-0 bottom-0 z-30 lg:hidden">
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
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1 py-2.5 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
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
                  "flex flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 text-[10px] font-semibold transition-all duration-200",
                  active ? "text-[hsl(var(--pp-brand))]" : "pp-text-subtle",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
                    active && "pp-nav-active scale-105",
                    !active && "bg-[hsl(var(--pp-brand-subtle))]",
                  )}
                >
                  <Icon className="h-[1.125rem] w-[1.125rem]" />
                </span>
                {item.mobileLabel}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 text-[10px] font-semibold transition-all duration-200",
              moreOpen || mobileMoreItems.includes(activeView)
                ? "text-[hsl(var(--pp-brand))]"
                : "pp-text-subtle",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
                (moreOpen || mobileMoreItems.includes(activeView)) && "pp-nav-active scale-105",
                !(moreOpen || mobileMoreItems.includes(activeView)) &&
                  "bg-[hsl(var(--pp-brand-subtle))]",
              )}
            >
              <MoreHorizontal className="h-[1.125rem] w-[1.125rem]" />
            </span>
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
