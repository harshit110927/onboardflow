"use client";

import { useState } from "react";
import { connectGmail, disconnectGmail, sendTestEmail } from "../actions";

export function GmailSettingsForm({
  currentEmail,
  isVerified,
}: {
  currentEmail: string | null;
  isVerified: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleConnect(formData: FormData) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await connectGmail(formData);
    if (result.success) setSuccess("Gmail connected successfully.");
    else setError(result.error);
    setLoading(false);
  }

  async function handleDisconnect() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await disconnectGmail();
    if (result.success) setSuccess("Gmail disconnected.");
    else setError(result.error);
    setLoading(false);
  }

  async function handleTestEmail() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await sendTestEmail();
    if (result.success) setSuccess("Test email sent — check your inbox.");
    else setError(result.error);
    setLoading(false);
  }

  if (isVerified && currentEmail) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">Connected</p>
            <p className="text-sm text-emerald-700">{currentEmail}</p>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleTestEmail}
            disabled={loading}
            className="text-sm rounded-md border border-border px-4 py-2 hover:bg-secondary transition-colors disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Test Email"}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="text-sm rounded-md border border-destructive/40 text-destructive px-4 py-2 hover:bg-destructive/5 transition-colors disabled:opacity-60"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={handleConnect} className="flex flex-col gap-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Gmail Address</label>
        <input
          name="smtpEmail"
          type="email"
          placeholder="you@gmail.com"
          required
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">App Password</label>
        <input
          name="smtpPassword"
          type="password"
          placeholder="16-character App Password"
          required
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-xs text-muted-foreground">
          This is not your Gmail password.{" "}
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Generate an App Password here
          </a>{" "}
          (requires 2-Step Verification to be enabled).
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="self-start text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {loading ? "Connecting..." : "Connect Gmail"}
      </button>
    </form>
  );
}