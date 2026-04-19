"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

export function NudgeButton({ stepIndex, eventName }: { stepIndex: number; eventName: string }) {
  const [loading, setLoading] = useState(false);

  const handleNudge = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/nudge-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepIndex }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to send nudges.");
        return;
      }

      if (data.sent === 0) {
        toast.info(`No eligible users to nudge for Step ${stepIndex}. They may have already received this nudge or completed the step.`);
      } else {
        toast.success(`Sent ${data.sent} nudge${data.sent === 1 ? "" : "s"} for "${eventName}". ${data.skipped} skipped.`);
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleNudge}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Send className="h-3 w-3" />
      )}
      {loading ? "Sending..." : "Send Nudge"}
    </button>
  );
}