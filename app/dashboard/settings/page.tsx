"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft, Save, Mail, Zap, GitCommit, CheckCircle, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [runningCron, setRunningCron] = useState(false); // State for the manual run button
  const [loading, setLoading] = useState(false);
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
      emailBody3: ""
  });

  // Fetch saved settings on load
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
          body: JSON.stringify({
              ...formData,
              automationEnabled // Send the toggle state to the server
          })
      });
      setLoading(false);
      
      if (res.ok) toast.success("Automation Workflow Saved!");
      else toast.error("Failed to save.");
  };

  // Handler for manually triggering the Cron Job
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
      } catch (e) {
          toast.error("Network error triggering bot.");
      } finally {
          setRunningCron(false);
      }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (fetching) {
      return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Automation Workflow</h1>
                <p className="text-muted-foreground">Define the sequence of events and the emails triggered when users get stuck.</p>
            </div>
            <Link href="/dashboard">
                <Button variant="ghost"> <ArrowLeft className="mr-2 h-4 w-4"/> Back </Button>
            </Link>
        </div>

        <div className="grid gap-8">

            {/* AUTOMATION MASTER SWITCH & RUN BUTTON */}
            <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-blue-900 flex items-center gap-2">
                                Auto-Pilot Mode
                                {automationEnabled && (
                                    <span className="text-xs font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                                        Active
                                    </span>
                                )}
                            </CardTitle>
                            <CardDescription className="text-blue-700">
                                Automatically nudge users after 1 hour and 24 hours of inactivity.
                            </CardDescription>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {/* Manual Trigger Button */}
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="bg-white border-blue-200 text-blue-700 hover:bg-blue-100"
                                onClick={handleRunCron}
                                disabled={runningCron}
                            >
                                {runningCron ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Play className="h-3 w-3 mr-2" /> Run Now
                                    </>
                                )}
                            </Button>

                            {/* The Toggle */}
                            <div className="flex items-center space-x-2 border-l pl-4 border-blue-200">
                                <Switch 
                                    id="automation-mode" 
                                    checked={automationEnabled}
                                    onCheckedChange={setAutomationEnabled}
                                />
                                <Label htmlFor="automation-mode" className="font-bold text-blue-900">
                                    {automationEnabled ? "ON" : "OFF"}
                                </Label>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>
            
            {/* STEP 1: ACTIVATION */}
            <Card className="border-l-4 border-l-blue-500 shadow-md">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-blue-600" />
                        <CardTitle>Step 1: The Activation Goal</CardTitle>
                    </div>
                    <CardDescription>If a user signs up but fails to do this event, send this email.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-gray-700">Event Name (Code)</label>
                        <Input 
                            placeholder="e.g. connected_repo"
                            value={formData.activationStep}
                            onChange={(e) => handleChange("activationStep", e.target.value)}
                        />
                         <div className="bg-blue-50 p-3 rounded text-xs text-blue-800">
                            <b>Trigger:</b> Sent 1h after signup if event is missing.
                        </div>
                    </div>
                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600"><Mail className="w-4 h-4"/> Email Content</div>
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

            {/* STEP 2: ENGAGEMENT */}
            <Card className="border-l-4 border-l-purple-500 shadow-md">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <GitCommit className="h-5 w-5 text-purple-600" />
                        <CardTitle>Step 2: Engagement (Optional)</CardTitle>
                    </div>
                    <CardDescription>If they complete Step 1 but stop here, nudge them forward.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-gray-700">Event Name (Code)</label>
                        <Input 
                            placeholder="e.g. created_project"
                            value={formData.step2}
                            onChange={(e) => handleChange("step2", e.target.value)}
                        />
                    </div>
                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600"><Mail className="w-4 h-4"/> Email Content</div>
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

            {/* STEP 3: CONVERSION */}
            <Card className="border-l-4 border-l-green-500 shadow-md">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <CardTitle>Step 3: Conversion (Optional)</CardTitle>
                    </div>
                    <CardDescription>The final push (e.g., asking them to upgrade).</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-gray-700">Event Name (Code)</label>
                        <Input 
                            placeholder="e.g. upgraded_to_pro"
                            value={formData.step3}
                            onChange={(e) => handleChange("step3", e.target.value)}
                        />
                    </div>
                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600"><Mail className="w-4 h-4"/> Email Content</div>
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
        </div>
      </div>
    </div>
  );
}