"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2, Circle, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LabelList,
  AreaChart, Area, Legend
} from "recharts";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [resData, resOverview] = await Promise.all([
        fetch("/api/v1/analytics-data"),
        fetch("/api/v1/analytics/overview")
      ]);
      const json = await resData.json();
      const overviewJson = await resOverview.json();
      setData(json);
      setOverviewData(overviewJson);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!data || !overviewData) return <div>Error loading data</div>;

  const { funnelData, totalUsers } = data;
  const { activationRate, rescueRate, revenueAtRisk, riskTrendData } = overviewData;

  // Calculate "Stuck" counts based on the funnel data
  // Index 0: Signup, Index 1: Step 1, Index 2: Step 2, Index 3: Step 3
  const stuckAtStep1 = totalUsers - (funnelData[1]?.count || 0);
  const stuckAtStep2 = (funnelData[1]?.count || 0) - (funnelData[2]?.count || 0);
  const stuckAtStep3 = (funnelData[2]?.count || 0) - (funnelData[3]?.count || 0);

  return (
    <div className="theme-deep min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Analytics & Actions</h1>
                <p className="text-muted-foreground">Monitor funnel drop-offs and take action to recover users.</p>
            </div>
            <Link href="/dashboard">
                <Button variant="ghost"> <ArrowLeft className="mr-2 h-4 w-4"/> Back </Button>
            </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Activation Rate</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-emerald-600">{activationRate}%</div>
                    <p className="text-xs text-muted-foreground mt-1">Users who reached Step 1</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Revenue at Risk</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-red-600">${revenueAtRisk.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground mt-1">Sum of MRR in Cooling or Stall</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Rescue Rate</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-primary">{rescueRate}%</div>
                    <p className="text-xs text-muted-foreground mt-1">Users returned &lt;72hr post-nudge</p>
                </CardContent>
            </Card>
        </div>

        {/* RISK DISTRIBUTION OVER TIME */}
        <Card className="shadow-sm">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <CardTitle>Risk Distribution Over Time</CardTitle>
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground">
                                <Info className="h-4 w-4" />
                                <span className="sr-only">Interpreting User Health</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="start">
                            <div className="space-y-2">
                                <h4 className="font-medium leading-none">Interpreting User Health</h4>
                                <p className="text-sm text-muted-foreground">
                                    This chart shows the daily composition of your user base by risk level.
                                </p>
                                <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                                    <li>The vertical axis shows the total number of users.</li>
                                    <li>Each color layer represents a risk category.</li>
                                    <li>Look for trends: A thickening &quot;Gone Dark&quot; (bottom) layer suggests increasing churn, while a thicker top layer suggests high engagement.</li>
                                    <li>Use this to spot when your onboarding or retention efforts are effectively shifting users from &quot;At Risk&quot; to &quot;Healthy&quot; states.</li>
                                </ul>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
                <CardDescription>30-day trailing heuristic assessment of user drop-off segments.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={riskTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorGoneDark" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorCooling" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorPre" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{fontSize: 12}} />
                            <YAxis tick={{fontSize: 12}} />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <RechartsTooltip />
                            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }}/>
                            <Area type="monotone" name="Gone Dark" dataKey="GONE_DARK" stackId="1" stroke="#dc2626" fill="url(#colorGoneDark)" />
                            <Area type="monotone" name="Cooling" dataKey="COOLING" stackId="1" stroke="#d97706" fill="url(#colorCooling)" />
                            <Area type="monotone" name="Pre-Activation Stall" dataKey="PRE_ACTIVATION_STALL" stackId="1" stroke="#eab308" fill="url(#colorPre)" />
                            <Area type="monotone" name="Post-Activation Stall" dataKey="POST_ACTIVATION_STALL" stackId="1" stroke="#64748b" fill="#94a3b8" />
                            <Area type="monotone" name="Never Started" dataKey="NEVER_STARTED" stackId="1" stroke="#b91c1c" fill="#f87171" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            
            {/* FUNNEL & NUDGE CARD */}
            <Card className="col-span-4 border-l-4 border-l-primary shadow-sm">
                <CardHeader>
                    <CardTitle>Conversion Funnel</CardTitle>
                    <CardDescription>Visualize onboarding drop-offs in real time.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* CHART */}
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={funnelData} margin={{ left: 0, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="step" type="category" width={80} tick={{fontSize: 12}} />
                                <RechartsTooltip cursor={{fill: 'transparent'}} />
                                <Bar dataKey="percent" radius={[0, 4, 4, 0]} barSize={24}>
                                    {funnelData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                    <LabelList dataKey="percent" position="right" formatter={(val: any) => `${val}%`} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* DROP-OFF COUNTS */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t bg-secondary/30 p-4 rounded-b-lg">
                        
                        {/* Step 1 Control */}
                        <div className="space-y-2 text-center">
                           <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 1 Drop-off</div>
                           <div className="text-2xl font-bold text-foreground">{stuckAtStep1}</div>
                           <div className="text-xs text-muted-foreground mb-2">users stuck</div>
                           <div className="text-xs text-muted-foreground">Auto-email handled by cron</div>
                        </div>

                        {/* Step 2 Control */}
                        <div className="space-y-2 text-center border-l border-border">
                           <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 2 Drop-off</div>
                           <div className="text-2xl font-bold text-foreground">{stuckAtStep2}</div>
                           <div className="text-xs text-muted-foreground mb-2">users stuck</div>
                           <div className="text-xs text-muted-foreground">Auto-email handled by cron</div>
                        </div>
                        
                        {/* Step 3 Control */}
                        <div className="space-y-2 text-center border-l border-border">
                           <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 3 Drop-off</div>
                           <div className="text-2xl font-bold text-foreground">{stuckAtStep3}</div>
                           <div className="text-xs text-muted-foreground mb-2">users stuck</div>
                           <div className="text-xs text-muted-foreground">Auto-email handled by cron</div>
                        </div>

                    </div>
                </CardContent>
            </Card>

        </div>
      </div>
    </div>
  );
}
