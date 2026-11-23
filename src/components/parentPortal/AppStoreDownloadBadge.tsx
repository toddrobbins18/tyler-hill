import {
  THE_NEST_ANDROID_PLAY_STORE_URL,
  THE_NEST_IOS_APP_STORE_URL,
} from "@/lib/theNestAppLinks";
import { cn } from "@/lib/utils";

type NestAppDownloadBadgesProps = {
  className?: string;
};

/**
 * Official-style App Store + Google Play badges for The Nest.
 * @see https://developer.apple.com/app-store/marketing/guidelines/
 * @see https://play.google.com/intl/en_us/badges/
 */
export function NestAppDownloadBadges({ className }: NestAppDownloadBadgesProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <a
        href={THE_NEST_IOS_APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download The Nest on the App Store"
      >
        <img
          src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83"
          alt="Download on the App Store"
          className="h-10 w-auto transition-opacity hover:opacity-80 active:opacity-70 md:h-11"
          width={250}
          height={83}
          loading="lazy"
        />
      </a>
      <a
        href={THE_NEST_ANDROID_PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get The Nest on Google Play"
      >
        <img
          src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
          alt="Get it on Google Play"
          className="-mx-2 h-[52px] w-auto transition-opacity hover:opacity-80 active:opacity-70 md:h-[58px]"
          width={206}
          height={80}
          loading="lazy"
        />
      </a>
    </div>
  );
}

/** @deprecated Use NestAppDownloadBadges — kept so existing imports keep working. */
export function AppStoreDownloadBadge({ className }: NestAppDownloadBadgesProps) {
  return <NestAppDownloadBadges className={className} />;
}
