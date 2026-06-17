"use client";

import Link from "next/link";
import { X, AlertTriangle, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

type Usage = {
  trackedUsers: number;
  trackedUsersLimit: number;
  trackedUsersApproaching: boolean;
  trackedUsersOverLimit: boolean;
  emailsSentThisMonth: number;
  emailsMonthlyLimit: number;
  emailsApproaching: boolean;
  emailsOverLimit: boolean;
  plan: string;
};

type BannerSeverity = "warning" | "danger" | "approaching";

const DISMISS_KEYS = {
  userLimit: "dripmetric_dismiss_user_limit_banner",
  emailLimit: "dripmetric_dismiss_email_limit_banner",
  userApproaching: "dripmetric_dismiss_user_approaching_banner",
  emailApproaching: "dripmetric_dismiss_email_approaching_banner",
} as const;

const SEVERITY_STYLES: Record<BannerSeverity, { wrapper: string; cta: string }> = {
  approaching: {
    wrapper: "border-blue-200 bg-blue-50 text-blue-950",
    cta: "bg-blue-700 text-white hover:bg-blue-800",
  },
  warning: {
    wrapper: "border-amber-300 bg-amber-50 text-amber-950",
    cta: "bg-amber-900 text-white hover:bg-amber-800",
  },
  danger: {
    wrapper: "border-rose-300 bg-rose-50 text-rose-950",
    cta: "bg-rose-900 text-white hover:bg-rose-800",
  },
};

function LimitBanner({
  severity,
  icon: Icon,
  message,
  onDismiss,
}: {
  severity: BannerSeverity;
  icon: typeof AlertTriangle;
  message: string;
  onDismiss: () => void;
}) {
  const styles = SEVERITY_STYLES[severity];

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${styles.wrapper}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium leading-6 flex items-start gap-2">
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{message}</span>
          </p>
          <Link
            href="/dashboard/enterprise/billing"
            className={`inline-flex rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${styles.cta}`}
          >
            Upgrade Plan →
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
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({
    userLimit: true,
    emailLimit: true,
    userApproaching: true,
    emailApproaching: true,
  });

  useEffect(() => {
    setDismissed({
      userLimit: sessionStorage.getItem(DISMISS_KEYS.userLimit) === "true",
      emailLimit: sessionStorage.getItem(DISMISS_KEYS.emailLimit) === "true",
      userApproaching: sessionStorage.getItem(DISMISS_KEYS.userApproaching) === "true",
      emailApproaching: sessionStorage.getItem(DISMISS_KEYS.emailApproaching) === "true",
    });
  }, []);

  const dismiss = (key: keyof typeof DISMISS_KEYS) => {
    sessionStorage.setItem(DISMISS_KEYS[key], "true");
    setDismissed((prev) => ({ ...prev, [key]: true }));
  };

  // Don't show approaching banners for "advanced" plan (highest tier)
  const showApproachingBanners = usage.plan !== "advanced";

  const untrackedUsers = Math.max(0, usage.trackedUsers - usage.trackedUsersLimit);
  const suppressedEmails = Math.max(0, usage.emailsSentThisMonth - usage.emailsMonthlyLimit);

  const userPct = usage.trackedUsersLimit > 0 ? Math.round((usage.trackedUsers / usage.trackedUsersLimit) * 100) : 0;
  const emailPct = usage.emailsMonthlyLimit > 0 ? Math.round((usage.emailsSentThisMonth / usage.emailsMonthlyLimit) * 100) : 0;

  // Over-limit banners (existing behavior)
  const showUserOverLimit = usage.trackedUsersOverLimit && !dismissed.userLimit;
  const showEmailOverLimit = usage.emailsOverLimit && !dismissed.emailLimit;

  // Approaching-limit banners (new 90% threshold)
  const showUserApproaching = showApproachingBanners && usage.trackedUsersApproaching && !usage.trackedUsersOverLimit && !dismissed.userApproaching;
  const showEmailApproaching = showApproachingBanners && usage.emailsApproaching && !usage.emailsOverLimit && !dismissed.emailApproaching;

  if (!showUserOverLimit && !showEmailOverLimit && !showUserApproaching && !showEmailApproaching) return null;

  const planLabel = usage.plan === "free" ? "Free" : usage.plan === "basic" ? "Startup" : "Growth";
  const nextPlan = usage.plan === "free" ? "Startup" : "Growth";

  return (
    <div className="space-y-3">
      {/* APPROACHING 90% – Tracked Users */}
      {showUserApproaching && (
        <LimitBanner
          severity="approaching"
          icon={TrendingUp}
          message={`You're using ${userPct}% of your tracked users (${usage.trackedUsers}/${usage.trackedUsersLimit}). Consider upgrading to ${nextPlan} before you hit the limit.`}
          onDismiss={() => dismiss("userApproaching")}
        />
      )}

      {/* APPROACHING 90% – Emails */}
      {showEmailApproaching && (
        <LimitBanner
          severity="approaching"
          icon={TrendingUp}
          message={`You've used ${emailPct}% of your monthly emails (${usage.emailsSentThisMonth}/${usage.emailsMonthlyLimit}). Upgrade to ${nextPlan} for more sends.`}
          onDismiss={() => dismiss("emailApproaching")}
        />
      )}

      {/* OVER LIMIT – Tracked Users */}
      {showUserOverLimit && (
        <LimitBanner
          severity={usage.plan === "free" ? "danger" : "warning"}
          icon={AlertTriangle}
          message={`You have ${untrackedUsers} users Dripmetric is not fully tracking because you've exceeded the ${planLabel} plan limit (${usage.trackedUsersLimit}). Upgrade to ${nextPlan} to keep tracking all users.`}
          onDismiss={() => dismiss("userLimit")}
        />
      )}

      {/* OVER LIMIT – Emails */}
      {showEmailOverLimit && (
        <LimitBanner
          severity="danger"
          icon={AlertTriangle}
          message={`${suppressedEmails} recovery emails were not sent this month because you've reached your ${planLabel} plan limit (${usage.emailsMonthlyLimit}/month). Upgrade to ${nextPlan} for more emails.`}
          onDismiss={() => dismiss("emailLimit")}
        />
      )}
    </div>
  );
}
