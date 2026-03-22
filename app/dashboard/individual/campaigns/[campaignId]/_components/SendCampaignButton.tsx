"use client";

import { useState } from "react";

export function SendCampaignButton({
  campaignId,
  contactCount,
  sendAction,
}: {
  campaignId: number;
  contactCount: number;
  sendAction: (formData: FormData) => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <form
      action={async (formData) => {
        if (!confirm(`Send this campaign to ${contactCount} contact${contactCount !== 1 ? "s" : ""}? This cannot be undone.`)) return;
        setSending(true);
        await sendAction(formData);
        setDone(true);
        setSending(false);
      }}
    >
      <input type="hidden" name="campaignId" value={campaignId} />
      <button
        type="submit"
        disabled={sending || done}
        className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
      >
        {sending ? "Sending..." : done ? "Sent ✓" : "Send Now"}
      </button>
    </form>
  );
}