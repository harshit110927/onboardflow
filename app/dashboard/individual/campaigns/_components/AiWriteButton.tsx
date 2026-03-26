"use client";

import { useState } from "react";

type Props = {
  isPremium: boolean;
  onGenerated: (subject: string, body: string) => void;
};

export function AiWriteButton({ isPremium, onGenerated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessDescription: "",
    tone: "friendly" as "friendly" | "professional" | "urgent",
    campaignType: "welcome" as "welcome" | "nurture" | "promotional",
  });

  if (!isPremium) {
    return (
      <div className="relative group inline-block">
        <button
          disabled
          className="text-sm rounded-md border border-border px-3 py-2 text-muted-foreground opacity-60 cursor-not-allowed"
        >
          ✦ AI Write
        </button>
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-56 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-md">
          Available on Premium plan.
        </div>
      </div>
    );
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/individual/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
        return;
      }
      onGenerated(data.subject, data.body);
      setOpen(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm rounded-md border border-primary/40 text-primary px-3 py-2 hover:bg-primary/5 transition-colors"
      >
        ✦ AI Write
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">AI Email Writer</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground text-lg leading-none"
              >
                ×
              </button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Describe your business in one sentence
              </label>
              <input
                type="text"
                value={form.businessDescription}
                onChange={(e) => setForm((f) => ({ ...f, businessDescription: e.target.value }))}
                placeholder="e.g. We help freelancers track their invoices automatically"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-foreground">Tone</label>
                <select
                  value={form.tone}
                  onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value as typeof form.tone }))}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                >
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-sm font-medium text-foreground">Type</label>
                <select
                  value={form.campaignType}
                  onChange={(e) => setForm((f) => ({ ...f, campaignType: e.target.value as typeof form.campaignType }))}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                >
                  <option value="welcome">Welcome</option>
                  <option value="nurture">Nurture</option>
                  <option value="promotional">Promotional</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleGenerate}
                disabled={loading || !form.businessDescription.trim()}
                className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {loading ? "Generating..." : "Generate"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}