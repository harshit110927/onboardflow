"use client";

import { useState } from "react";
import { AiWriteButton } from "./AiWriteButton";

type List = { id: number; name: string };

type Props = {
  availableLists: List[];
  defaultListId?: string;
  aiEnabled: boolean;
  createAction: (formData: FormData) => Promise<void>;
};

export function CreateCampaignForm({ availableLists, defaultListId, aiEnabled, createAction }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  return (
    <form action={createAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="listId" className="text-sm font-medium text-foreground">
          Send to List <span className="text-destructive">*</span>
        </label>
        <select
          id="listId"
          name="listId"
          required
          defaultValue={defaultListId ?? ""}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="" disabled>Select a list...</option>
          {availableLists.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="subject" className="text-sm font-medium text-foreground">
            Subject Line <span className="text-destructive">*</span>
          </label>
          <AiWriteButton
            aiEnabled={aiEnabled}
            onGenerated={(s, b) => { setSubject(s); setBody(b); }}
          />
        </div>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          maxLength={255}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Welcome to our community!"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="text-sm font-medium text-foreground">
          Email Body <span className="text-destructive">*</span>
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your email here..."
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-foreground">When to Send</label>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="scheduleType" value="draft" defaultChecked className="accent-primary" />
            <span className="text-foreground">Save as draft</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="scheduleType" value="later" className="accent-primary" />
            <span className="text-foreground">Schedule for later</span>
          </label>
        </div>
        <input
          type="datetime-local"
          name="scheduledAt"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground -mt-1">
          Only used if you selected "Schedule for later" above.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Save Campaign
        </button>
      </div>
    </form>
  );
}
