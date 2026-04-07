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

  return (
    <form
      // FIX — use direct server-action form submission so send always issues a POST when confirmed
      action={sendAction}
      onSubmit={(event) => {
        const confirmed = confirm(`Send this campaign to ${contactCount} contact${contactCount !== 1 ? "s" : ""}? This cannot be undone.`);
        if (!confirmed) {
          event.preventDefault();
          return;
        }
        setSending(true);
      }}
    >
      <input type="hidden" name="campaignId" value={campaignId} />
      <button
        type="submit"
        disabled={sending}
        className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
      >
        {sending ? "Sending..." : "Send Now"}
      </button>
    </form>
  );
}
