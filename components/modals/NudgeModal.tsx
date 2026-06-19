"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type NudgeTarget = {
  email: string;
  riskLabel?: string | null;
  riskScore?: number | null;
};

export function NudgeModal({
  isOpen,
  onClose,
  target,
}: {
  isOpen: boolean;
  onClose: () => void;
  target: NudgeTarget | null;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!target) return;
    setSending(true);
    const res = await fetch("/api/v1/nudge-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: target.email, subject, body }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to send nudge.");
      setSending(false);
      return;
    }

    setSending(false);
    setSubject("");
    setBody("");
    onClose();
    alert(`Nudge successfully sent to ${target.email}!`);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Manual Nudge</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            Targeting: <strong className="text-foreground">{target?.email}</strong>
            {target?.riskLabel && (
              <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700">
                {target.riskLabel} ({target.riskScore})
              </span>
            )}
          </p>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Subject</label>
            <Input 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)} 
              placeholder="e.g. Checking in on your setup"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Message Body</label>
            <Textarea 
              value={body} 
              onChange={(e) => setBody(e.target.value)} 
              placeholder="Hi there, I noticed you might be stuck..."
              rows={4}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}>
            {sending ? "Sending..." : "Dispatch Outreach"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
