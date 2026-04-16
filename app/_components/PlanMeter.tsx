import Link from "next/link";

type Props = {
  plan: string;
  used: number;
  limit: number;
  renewalDate?: Date | null;
  billingPath: string;
};

export default function PlanMeter({ plan, used, limit, renewalDate, billingPath }: Props) {
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Plan: {plan}</span>
        <span>{used} / {limit} emails</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {renewalDate && plan.toLowerCase() !== "free" && (
        <p className="text-xs text-muted-foreground mt-2">Renews {renewalDate.toLocaleDateString("en-US")}</p>
      )}
      {plan.toLowerCase() === "free" && (
        <Link href={billingPath} className="text-xs text-primary underline mt-2 inline-block">Upgrade</Link>
      )}
    </div>
  );
}
