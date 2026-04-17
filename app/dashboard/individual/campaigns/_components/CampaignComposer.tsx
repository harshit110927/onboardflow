"use client";

import { useMemo, useState } from "react";
import { AiWriteButton } from "./AiWriteButton";

type ListOption = {
  id: number;
  name: string;
  totalContacts: number;
  previewContacts: Array<{ name: string; email: string }>;
};

export function CampaignComposer({
  lists,
  aiEnabled,
  createAction,
}: {
  lists: ListOption[];
  aiEnabled: boolean;
  createAction: (formData: FormData) => Promise<void>;
}) {
  const [selectedListId, setSelectedListId] = useState<number>(lists[0]?.id ?? 0);
  const [subject, setSubject] = useState("Strategic Growth for Founders");
  const [body, setBody] = useState(`Hi {name},\n\nThanks so much for responding — we're thrilled to hear you're interested.\n\nPlease schedule a call at your convenience here: [scheduling link]\n\nBest,\nThe OnboardFlow Team`);
  const [scheduledAt, setScheduledAt] = useState("");

  const selectedList = useMemo(
    () => lists.find((l) => l.id === selectedListId) ?? lists[0],
    [lists, selectedListId],
  );

  if (!selectedList) {
    return null;
  }

  return (
    <form action={createAction} className="rounded-xl border border-border bg-card p-6 space-y-5">
      <input type="hidden" name="listId" value={selectedList.id} />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Create campaign</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedList.name} · {selectedList.totalContacts} contacts
          </p>
        </div>
        <select
          value={selectedList.id}
          onChange={(e) => setSelectedListId(Number(e.target.value))}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Subject line</label>
            <input
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground"
            />
          </div>

          <div className="rounded-lg bg-secondary px-4 py-3 text-sm text-foreground flex items-center justify-between gap-3">
            <span>Write with AI — describe your goal and we&apos;ll draft it for you</span>
            <AiWriteButton aiEnabled={aiEnabled} onGenerated={(s, b) => { setSubject(s); setBody(b); }} />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email body · use {'{name}'} to personalise</label>
            <textarea
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground resize-y"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-2">Schedule (optional)</label>
            <input
              type="datetime-local"
              name="scheduledAt"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="submit"
              name="intent"
              value="draft"
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary"
            >
              Save draft
            </button>
            <button
              type="submit"
              name="intent"
              value="schedule"
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary"
            >
              Schedule
            </button>
            <button
              type="submit"
              name="intent"
              value="send_now"
              className="rounded-lg bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:opacity-90"
            >
              Send now — {selectedList.totalContacts} contacts
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm font-medium text-foreground mb-3">Recipients · {selectedList.totalContacts} contacts</div>
            <div className="space-y-2">
              {selectedList.previewContacts.map((contact, idx) => (
                <div key={`${contact.email}-${idx}`} className="border-b border-border last:border-b-0 pb-2 last:pb-0">
                  <div className="text-sm text-foreground font-medium">{contact.name}</div>
                  <div className="text-xs text-muted-foreground">{contact.email}</div>
                </div>
              ))}
            </div>
            {selectedList.totalContacts > selectedList.previewContacts.length && (
              <div className="text-xs text-muted-foreground text-center mt-2">
                + {selectedList.totalContacts - selectedList.previewContacts.length} more contacts
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border p-4 bg-secondary/30">
            <div className="text-sm font-medium text-foreground mb-1">Open tracking</div>
            <p className="text-xs text-muted-foreground">Rates will appear once campaign is sent (plan permitting).</p>
          </div>
        </div>
      </div>
    </form>
  );
}
