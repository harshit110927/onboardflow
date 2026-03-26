"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = {
  subject: string;
  body: string;
  delayDays: number;
};

const EMPTY_STEP: Step = { subject: "", body: "", delayDays: 1 };

export function SequenceBuilder({
  listId,
  listName,
  tenantId,
}: {
  listId: number;
  listName: string;
  tenantId: string;
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>([{ ...EMPTY_STEP, delayDays: 0 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addStep() {
    if (steps.length >= 5) return;
    setSteps((s) => [...s, { ...EMPTY_STEP }]);
  }

  function removeStep(i: number) {
    if (steps.length <= 1) return;
    setSteps((s) => s.filter((_, idx) => idx !== i));
  }

  function updateStep(i: number, field: keyof Step, value: string | number) {
    setSteps((s) => s.map((step, idx) => idx === i ? { ...step, [field]: value } : step));
  }

  async function handleSubmit() {
    for (const [i, step] of steps.entries()) {
      if (!step.subject.trim() || !step.body.trim()) {
        setError(`Step ${i + 1} is missing subject or body.`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/individual/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId, steps }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create sequence.");
        return;
      }

      router.push(`/dashboard/individual/lists/${listId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {steps.map((step, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <h3 className="font-semibold text-foreground">
                {i === 0 ? "First Email (sends immediately)" : `Step ${i + 1}`}
              </h3>
            </div>
            {steps.length > 1 && (
              <button
                onClick={() => removeStep(i)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Remove
              </button>
            )}
          </div>

          {i > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground shrink-0">
                Send after
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={step.delayDays}
                onChange={(e) => updateStep(i, "delayDays", Number(e.target.value))}
                className="w-16 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <label className="text-sm text-muted-foreground">
                day{step.delayDays !== 1 ? "s" : ""} from previous step
              </label>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Subject</label>
            <input
              type="text"
              value={step.subject}
              maxLength={255}
              onChange={(e) => updateStep(i, "subject", e.target.value)}
              placeholder="Email subject line"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Body</label>
            <textarea
              value={step.body}
              onChange={(e) => updateStep(i, "body", e.target.value)}
              rows={5}
              placeholder="Email body..."
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        {steps.length < 5 && (
          <button
            onClick={addStep}
            className="text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors"
          >
            + Add Step
          </button>
        )}
        <span className="text-xs text-muted-foreground">{steps.length} / 5 steps</span>
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 px-5 py-4 text-sm text-muted-foreground">
        Sending to list: <span className="font-medium text-foreground">{listName}</span>.
        The first email sends immediately when you publish. Subsequent steps send automatically based on the delay you set.
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="text-sm rounded-md bg-primary text-primary-foreground px-5 py-2 font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {loading ? "Publishing..." : "Publish Sequence"}
        </button>
        <button
          onClick={() => router.back()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}