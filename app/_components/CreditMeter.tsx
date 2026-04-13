// MODIFIED — razorpay credits migration — added reusable nav credit meter with expandable usage/help panel
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  credits: number;
  tier: "individual" | "enterprise";
  billingPath: string;
};

export default function CreditMeter({ credits, tier, billingPath }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toneClass =
    credits > 10000
      ? "bg-emerald-100 text-emerald-700"
      : credits > 1000
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  const percent = Math.max(4, Math.min(100, Math.round((credits / 10000) * 100)));
  const isZero = credits === 0;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => {
          if (isZero) {
            router.push(billingPath);
            return;
          }
          setOpen((prev) => !prev);
        }}
        className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${isZero ? "bg-secondary text-muted-foreground" : toneClass}`}
      >
        {/* FIX — show explicit zero-credits CTA state instead of empty progress bar */}
        {!isZero && (
          <span className="h-1.5 w-12 rounded-full bg-black/10 overflow-hidden">
            <span className="block h-full bg-current" style={{ width: `${percent}%` }} />
          </span>
        )}
        <span>{isZero ? "0 credits — Buy to unlock features" : `${credits.toLocaleString()} credits`}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-64 rounded-lg border border-border bg-card shadow-lg p-4">
          <p className="text-xs text-muted-foreground">Credit balance</p>
          <p className="text-2xl font-bold text-foreground mt-1">{credits.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {tier === "individual"
              ? "10 credits per email · 25 credits per AI campaign"
              : "10 credits per drip email"}
          </p>
          <Link
            href={billingPath}
            className="mt-4 inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Buy Credits
          </Link>
        </div>
      )}
    </div>
  );
}
