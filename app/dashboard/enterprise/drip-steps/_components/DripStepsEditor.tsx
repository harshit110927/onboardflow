"use client";

import { useState } from "react";

type Step = {
  id?: number;
  position: number;
  eventTrigger: string;
  emailSubject: string;
  emailBody: string;
  delayHours: number;
};

export function DripStepsEditor({ initialSteps }: { initialSteps: Step[] }) {
  const [steps, setSteps] = useState<Step[]>(
    initialSteps.length > 0
      ? initialSteps
      : [{ position: 1, eventTrigger: "", emailSubject: "", emailBody: "", delayHours: 1 }]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function addStep() {
    setSteps((s) => [
      ...s,
      { position: s.length + 1, eventTrigger: "", emailSubject: "", emailBody: "", delayHours: 24 },
    ]);
  }

  function removeStep(i: number) {
    if (steps.length <= 1) return;
    setSteps((s) =>
      s.filter((_, idx) => idx !== i).map((step, idx) => ({ ...step, position: idx + 1 }))
    );
  }

  function updateStep(i: number, field: keyof Step, value: string | number) {
    setSteps((s) => s.map((step, idx) => idx === i ? { ...step, [field]: value } : step));
  }

  async function handleSave() {
    for (const [i, step] of steps.entries()) {
      if (!step.eventTrigger.trim() || !step.emailSubject.trim() || !step.emailBody.trim()) {
        setError(`Step ${i + 1} is missing required fields.`);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/individual/drip-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
      setSuccess(true);
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
      {success && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          ✓ Drip steps saved successfully.
        </div>
      )}

      {steps.map((step, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <h3 className="font-semibold text-foreground">Step {i + 1}</h3>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Event Trigger</label>
              <input
                type="text"
                value={step.eventTrigger}
                onChange={(e) => updateStep(i, "eventTrigger", e.target.value)}
                placeholder="e.g. connected_repo"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-muted-foreground">Send if user hasn't completed this event</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Delay (hours)</label>
              <input
                type="number"
                min={1}
                value={step.delayHours}
                onChange={(e) => updateStep(i, "delayHours", Number(e.target.value))}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-muted-foreground">Hours after signup to trigger</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Email Subject</label>
            <input
              type="text"
              value={step.emailSubject}
              maxLength={255}
              onChange={(e) => updateStep(i, "emailSubject", e.target.value)}
              placeholder="Subject line"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Email Body</label>
            <textarea
              value={step.emailBody}
              onChange={(e) => updateStep(i, "emailBody", e.target.value)}
              rows={4}
              placeholder="Email body..."
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          onClick={addStep}
          className="text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors"
        >
          + Add Step
        </button>
        <span className="text-xs text-muted-foreground">{steps.length} steps configured</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={loading}
          className="text-sm rounded-md bg-primary text-primary-foreground px-5 py-2 font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Steps"}
        </button>
        <a href="/dashboard/enterprise" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </a>
      </div>
    </div>
  );
}