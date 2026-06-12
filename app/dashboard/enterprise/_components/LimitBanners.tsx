"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

type Usage = {
  trackedUsers: number;
  trackedUsersLimit: number;
  trackedUsersOverLimit: boolean;
  emailsSentThisMonth: number;
  emailsMonthlyLimit: number;
  emailsOverLimit: boolean;
};

type BannerType = "users" | "emails";

const USER_LIMIT_KEY = "dripmetric_dismiss_user_limit_banner";
const EMAIL_LIMIT_KEY = "dripmetric_dismiss_email_limit_banner";

function LimitBanner({
  type,
  message,
  onDismiss,
}: {
  type: BannerType;
  message: string;
  onDismiss: () => void;
}) {
  const accent = type === "users" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-rose-300 bg-rose-50 text-rose-950";
  const cta = type === "users" ? "bg-amber-900 text-white hover:bg-amber-800" : "bg-rose-900 text-white hover:bg-rose-800";

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${accent}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium leading-6">{message}</p>
          <Link
            href="/pricing"
            className={`inline-flex rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${cta}`}
          >
            See plans
          </Link>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="self-start rounded-md p-1 transition-colors hover:bg-black/10"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function LimitBanners({ usage }: { usage: Usage }) {
  const [dismissedUserLimit, setDismissedUserLimit] = useState(true);
  const [dismissedEmailLimit, setDismissedEmailLimit] = useState(true);

  useEffect(() => {
    setDismissedUserLimit(sessionStorage.getItem(USER_LIMIT_KEY) === "true");
    setDismissedEmailLimit(sessionStorage.getItem(EMAIL_LIMIT_KEY) === "true");
  }, []);

  const dismissUserLimit = () => {
    sessionStorage.setItem(USER_LIMIT_KEY, "true");
    setDismissedUserLimit(true);
  };

  const dismissEmailLimit = () => {
    sessionStorage.setItem(EMAIL_LIMIT_KEY, "true");
    setDismissedEmailLimit(true);
  };

  const untrackedUsers = Math.max(0, usage.trackedUsers - usage.trackedUsersLimit);
  const suppressedEmails = Math.max(0, usage.emailsSentThisMonth - usage.emailsMonthlyLimit);
  const showUserLimit = usage.trackedUsersOverLimit && !dismissedUserLimit;
  const showEmailLimit = usage.emailsOverLimit && !dismissedEmailLimit;

  if (!showUserLimit && !showEmailLimit) return null;

  return (
    <div className="space-y-3">
      {showUserLimit && (
        <LimitBanner
          type="users"
          message={`You have ${untrackedUsers} users Dripmetric is not fully tracking because you are on the free plan. Upgrade to Basic to track up to 500 users.`}
          onDismiss={dismissUserLimit}
        />
      )}
      {showEmailLimit && (
        <LimitBanner
          type="emails"
          message={`${suppressedEmails} recovery emails were not sent this month because you have reached your free plan limit. Upgrade to Basic to send up to 3,000 emails per month.`}
          onDismiss={dismissEmailLimit}
        />
      )}
    </div>
  );
}
