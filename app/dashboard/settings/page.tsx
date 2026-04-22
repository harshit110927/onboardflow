"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft, Save, Mail, Zap, GitCommit, CheckCircle, Loader2, Play, LogOut, SendHorizonal, Wifi } from "lucide-react";
import { toast } from "sonner";
import { logout } from "./actions";

export default function SettingsPage() {
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [runningCron, setRunningCron] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [formData, setFormData] = useState({
    activationStep: "connect_repo",
    emailSubject: "",
    emailBody: "",
    step2: "",
    emailSubject2: "",
    emailBody2: "",
    step3: "",
    emailSubject3: "",
    emailBody3: "",
  });

  const [emailSending, setEmailSending] = useState({
    resendApiKey: "",
    resendFromEmail: "",
    hasExistingKey: false,
  });
  const [whatsappTemplate, setWhatsappTemplate] = useState("Hi {name}, ");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/v1/settings");
        const data = await res.json();
        if (data) {
          setAutomationEnabled(data.automationEnabled || false);
          setFormData({
            activationStep: data.activationStep || "connect_repo",
            emailSubject: data.emailSubject || "",
            emailBody: data.emailBody || "",
            step2: data.step2 || "",
            emailSubject2: data.emailSubject2 || "",
            emailBody2: data.emailBody2 || "",
            step3: data.step3 || "",
            emailSubject3: data.emailSubject3 || "",
            emailBody3: data.emailBody3 || "",
          });
          setEmailSending({
            resendApiKey: "",
            resendFromEmail: data.resendFromEmail || "",
            hasExistingKey: !!data.resendApiKey,
          });
          setWhatsappTemplate(data.whatsappTemplate || "Hi {name}, ");
        }
      } catch (e) {
        console.error(e);
        toast.error("Could not load settings");
      } finally {
        setFetching(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    const res = await fetch("/api/v1/settings", {
      method: "POST",
      body: JSON.stringify({ ...formData, automationEnabled }),
    });
    setLoading(false);
    if (res.ok) toast.success("Automation Workflow Saved!");
    else toast.error("Failed to save.");
  };

  const handleSaveEmailSending = async () => {
    if (!emailSending.resendApiKey && !emailSending.hasExistingKey) {
      toast.error("Please enter a Resend API key.");
      return;
    }
    if (emailSending.resendApiKey && !emailSending.resendFromEmail) {
      toast.error("Please enter a from email address.");
      return;
    }

    setSavingEmail(true);
    const res = await fetch("/api/v1/settings", {
      method: "POST",
      body: JSON.stringify({
        ...formData,
        automationEnabled,
        resendApiKey: emailSending.resendApiKey || undefined,
        resendFromEmail: emailSending.resendFromEmail,
      }),
    });
    setSavingEmail(false);

    if (res.ok) {
      toast.success("Email sending settings saved!");
      setEmailSending(prev => ({
        ...prev,
        hasExistingKey: true,
        resendApiKey: "",
      }));
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to save email settings.");
    }
  };

  const handleClearResendKey = async () => {
    setSavingEmail(true);
    const res = await fetch("/api/v1/settings", {
      method: "POST",
      body: JSON.stringify({
        ...formData,
        automationEnabled,
        resendApiKey: "",
        resendFromEmail: "",
      }),
    });
    setSavingEmail(false);
    if (res.ok) {
      toast.success("Resend key removed.");
      setEmailSending({ resendApiKey: "", resendFromEmail: "", hasExistingKey: false });
    } else {
      toast.error("Failed to remove key.");
    }
  };

  const handleRunCron = async () => {
    setRunningCron(true);
    try {
      const res = await fetch("/api/cron");
      const json = await res.json();
      if (json.success) {
        toast.success(`Bot ran successfully! Emails sent: ${json.emailsSent}`);
      } else {
        toast.error("Bot failed to run.");
      }
    } catch {
      toast.error("Network error triggering bot.");
    } finally {
      setRunningCron(false);
    }
  };

  const handleSaveWhatsapp = async () => {
    setSavingWhatsapp(true);
    try {
      const res = await fetch("/api/v1/settings", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          automationEnabled,
          whatsappTemplate,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      toast.success("WhatsApp settings saved");
    } catch (error) {
      toast.error("Failed to save");
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (fetching) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="theme-deep min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Automation Workflow</h1>
            <p className="text-muted-foreground">Define the sequence of events and the emails triggered when users get stuck.</p>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          </Link>
        </div>

        <div className="grid gap-8">

          {/* AUTO-PILOT SWITCH */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    Auto-Pilot Mode
                    {automationEnabled && (
                      <span className="text-xs font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                        Active
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Automatically nudge users after 1 hour and 24 hours of inactivity.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white border-border text-muted-foreground hover:bg-secondary"
                    onClick={handleRunCron}
                    disabled={runningCron}
                  >
                    {runningCron ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><Play className="h-3 w-3 mr-2" /> Run Now</>
                    )}
                  </Button>
                  <div className="flex items-center space-x-2 border-l pl-4 border-border">
                    <Switch
                      id="automation-mode"
                      checked={automationEnabled}
                      onCheckedChange={setAutomationEnabled}
                    />
                    <Label htmlFor="automation-mode" className="font-bold text-foreground">
                      {automationEnabled ? "ON" : "OFF"}
                    </Label>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* EMAIL SENDING */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <SendHorizonal className="h-5 w-5 text-primary" />
                <CardTitle>Email Sending</CardTitle>
              </div>
              <CardDescription>
                Connect your own Resend account so emails arrive from your domain, not ours.
                Without this, emails only deliver to your own inbox during testing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Status indicator */}
              {emailSending.hasExistingKey ? (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  <Wifi className="h-4 w-4" />
                  <span>Resend account connected — emails send from <b>{emailSending.resendFromEmail || "your domain"}</b></span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  <Mail className="h-4 w-4" />
                  <span>No sending account connected — using shared test domain (limited delivery)</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    {emailSending.hasExistingKey ? "Replace Resend API Key" : "Resend API Key"}
                  </Label>
                  <Input
                    type="password"
                    placeholder={emailSending.hasExistingKey ? "Enter new key to replace existing" : "re_live_..."}
                    value={emailSending.resendApiKey}
                    onChange={(e) => setEmailSending(prev => ({ ...prev, resendApiKey: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your key at{" "}
                    <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-primary underline">
                      resend.com/api-keys
                    </a>
                    . Make sure you have verified your domain in Resend first.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">From Email Address</Label>
                  <Input
                    type="email"
                    placeholder="hello@yourapp.com"
                    value={emailSending.resendFromEmail}
                    onChange={(e) => setEmailSending(prev => ({ ...prev, resendFromEmail: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must match a verified domain in your Resend account.
                    Example: <code>hello@yourapp.com</code> or <code>noreply@yourapp.com</code>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSaveEmailSending}
                    disabled={savingEmail}
                    className="flex-1"
                  >
                    {savingEmail ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating & Saving...</>
                    ) : (
                      <><Save className="mr-2 h-4 w-4" /> Save Email Settings</>
                    )}
                  </Button>
                  {emailSending.hasExistingKey && (
                    <Button
                      variant="outline"
                      onClick={handleClearResendKey}
                      disabled={savingEmail}
                      className="text-destructive border-destructive hover:bg-destructive/10"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              {/* Setup guide */}
              <div className="bg-secondary/40 rounded-lg border p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">Quick setup guide</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Create a free account at <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-primary underline">resend.com</a></li>
                  <li>Go to Domains → Add Domain → enter your domain</li>
                  <li>Add the DNS records Resend provides (takes ~10 minutes)</li>
                  <li>Go to API Keys → Create API Key → Full Access</li>
                  <li>Paste the key above and enter your from address</li>
                </ol>
              </div>

            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>WhatsApp Integration</CardTitle>
              <CardDescription>Configure the default message used for click-to-chat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label className="text-sm font-semibold">Message Template</Label>
              <Textarea
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                placeholder="Hi {name}, "
              />
              <p className="text-xs text-muted-foreground">
                Use {"{name}"} to insert the contact&apos;s name. This pre-fills when you click WhatsApp on a contact.
              </p>
              <Button onClick={handleSaveWhatsapp} disabled={savingWhatsapp}>
                {savingWhatsapp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* STEP 1 */}
          <Card className="border-l-4 border-l-primary shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <CardTitle>Step 1: The Activation Goal</CardTitle>
              </div>
              <CardDescription>If a user signs up but fails to do this event, send this email.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="text-sm font-bold text-foreground">Event Name (Code)</label>
                <Input
                  placeholder="e.g. connected_repo"
                  value={formData.activationStep}
                  onChange={(e) => handleChange("activationStep", e.target.value)}
                />
                <div className="bg-secondary p-3 rounded text-xs text-foreground">
                  <b>Trigger:</b> Sent 1h after signup if event is missing.
                </div>
              </div>
              <div className="space-y-3 p-4 bg-secondary/40 rounded-lg border">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Mail className="w-4 h-4" /> Email Content</div>
                <Input
                  placeholder="Subject Line"
                  value={formData.emailSubject}
                  onChange={(e) => handleChange("emailSubject", e.target.value)}
                />
                <Textarea
                  className="h-24"
                  placeholder="Email Body..."
                  value={formData.emailBody}
                  onChange={(e) => handleChange("emailBody", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* STEP 2 */}
          <Card className="border-l-4 border-l-primary shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <GitCommit className="h-5 w-5 text-primary" />
                <CardTitle>Step 2: Engagement (Optional)</CardTitle>
              </div>
              <CardDescription>If they complete Step 1 but stop here, nudge them forward.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="text-sm font-bold text-foreground">Event Name (Code)</label>
                <Input
                  placeholder="e.g. created_project"
                  value={formData.step2}
                  onChange={(e) => handleChange("step2", e.target.value)}
                />
              </div>
              <div className="space-y-3 p-4 bg-secondary/40 rounded-lg border">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Mail className="w-4 h-4" /> Email Content</div>
                <Input
                  placeholder="Subject: Don't stop now!"
                  value={formData.emailSubject2}
                  onChange={(e) => handleChange("emailSubject2", e.target.value)}
                />
                <Textarea
                  className="h-24"
                  placeholder="Email Body..."
                  value={formData.emailBody2}
                  onChange={(e) => handleChange("emailBody2", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* STEP 3 */}
          <Card className="border-l-4 border-l-primary shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <CardTitle>Step 3: Conversion (Optional)</CardTitle>
              </div>
              <CardDescription>The final push (e.g., asking them to upgrade).</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="text-sm font-bold text-foreground">Event Name (Code)</label>
                <Input
                  placeholder="e.g. upgraded_to_pro"
                  value={formData.step3}
                  onChange={(e) => handleChange("step3", e.target.value)}
                />
              </div>
              <div className="space-y-3 p-4 bg-secondary/40 rounded-lg border">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Mail className="w-4 h-4" /> Email Content</div>
                <Input
                  placeholder="Subject: Unlock Pro Features"
                  value={formData.emailSubject3}
                  onChange={(e) => handleChange("emailSubject3", e.target.value)}
                />
                <Textarea
                  className="h-24"
                  placeholder="Email Body..."
                  value={formData.emailBody3}
                  onChange={(e) => handleChange("emailBody3", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={loading} size="lg" className="w-full text-lg">
            {loading ? "Saving Workflow..." : <><Save className="mr-2 h-5 w-5" /> Save Automation Workflow</>}
          </Button>

          <div className="flex items-start gap-2 justify-center text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-100">
            <span className="text-lg">⚠️</span>
            <p className="text-sm">
              <b>Warning:</b> Changing your Event Names will immediately recalculate your dashboard statistics.
              Users who passed the old steps will not be counted in the new funnel.
            </p>
          </div>

          {/* SESSION */}
          <Card className="border-dashed border-amber-200 bg-background">
            <CardHeader>
              <CardTitle>Session</CardTitle>
              <CardDescription>
                Log out of OnboardFlow on this device when you're done managing your automation settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                This signs you out securely and returns you to the login screen.
              </p>
              <form action={logout}>
                <Button type="submit" variant="destructive" className="w-full sm:w-auto">
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </Button>
              </form>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
