import { THE_NEST_IOS_APP_STORE_URL } from "@/lib/theNestAppLinks";

type AppStoreDownloadBadgeProps = {
  className?: string;
};

/**
 * Official-style “Download on the App Store” badge linking to The Nest iOS app.
 * @see https://developer.apple.com/app-store/marketing/guidelines/
 */
export function AppStoreDownloadBadge({ className }: AppStoreDownloadBadgeProps) {
  return (
    <a
      href={THE_NEST_IOS_APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
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
  );
}
