import { cn } from "@/lib/utils";
import type { LoginAudience } from "@/lib/loginAudience";

type LoginAudienceToggleProps = {
  audience: LoginAudience;
  onAudienceChange: (next: LoginAudience) => void;
  className?: string;
};

export function LoginAudienceToggle({
  audience,
  onAudienceChange,
  className,
}: LoginAudienceToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-full bg-white/95 p-1 shadow-md ring-1 ring-black/5",
        className,
      )}
      role="tablist"
      aria-label="Sign in as"
    >
      {(["staff", "parent"] as const).map((value) => {
        const selected = audience === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "min-w-[5.5rem] rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              selected
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
            onClick={() => onAudienceChange(value)}
          >
            {value === "parent" ? "Parent" : "Staff"}
          </button>
        );
      })}
    </div>
  );
}
