"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2, Circle } from "lucide-react";
import { 
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LabelList 
} from "recharts";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/api/v1/analytics-data");
      const json = await res.json();
      setData(json);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!data) return <div>Error loading data</div>;

  const { funnelData, activeUsers, userMatrix, totalUsers } = data;

  // Calculate "Stuck" counts based on the funnel data
  // Index 0: Signup, Index 1: Step 1, Index 2: Step 2, Index 3: Step 3
  const stuckAtStep1 = totalUsers - (funnelData[1]?.count || 0);
  const stuckAtStep2 = (funnelData[1]?.count || 0) - (funnelData[2]?.count || 0);
  const stuckAtStep3 = (funnelData[2]?.count || 0) - (funnelData[3]?.count || 0);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
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

        {/* ... (Metrics Cards remain the same) ... */}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            
            {/* FUNNEL & NUDGE CARD */}
            <Card className="col-span-4 border-l-4 border-l-blue-600 shadow-sm">
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
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t bg-slate-50/50 p-4 rounded-b-lg">
                        
                        {/* Step 1 Control */}
                        <div className="space-y-2 text-center">
                           <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Step 1 Drop-off</div>
                           <div className="text-2xl font-bold text-slate-800">{stuckAtStep1}</div>
                           <div className="text-xs text-slate-400 mb-2">users stuck</div>
                           <div className="text-xs text-slate-500">Auto-email handled by cron</div>
                        </div>

                        {/* Step 2 Control */}
                        <div className="space-y-2 text-center border-l border-slate-200">
                           <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Step 2 Drop-off</div>
                           <div className="text-2xl font-bold text-slate-800">{stuckAtStep2}</div>
                           <div className="text-xs text-slate-400 mb-2">users stuck</div>
                           <div className="text-xs text-slate-500">Auto-email handled by cron</div>
                        </div>
                        
                        {/* Step 3 Control */}
                        <div className="space-y-2 text-center border-l border-slate-200">
                           <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Step 3 Drop-off</div>
                           <div className="text-2xl font-bold text-slate-800">{stuckAtStep3}</div>
                           <div className="text-xs text-slate-400 mb-2">users stuck</div>
                           <div className="text-xs text-slate-500">Auto-email handled by cron</div>
                        </div>

                    </div>
                </CardContent>
            </Card>

            {/* ... (User Matrix Card remains the same) ... */}
            
             <Card className="col-span-3">
                <CardHeader>
                    <CardTitle>User Progress Matrix</CardTitle>
                    <CardDescription>Real-time status of your 20 most recent users.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User Email</TableHead>
                                <TableHead className="text-center w-[60px]">S1</TableHead>
                                <TableHead className="text-center w-[60px]">S2</TableHead>
                                <TableHead className="text-center w-[60px]">S3</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {userMatrix.map((u: any, i: number) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium text-xs truncate max-w-[120px]" title={u.email}>{u.email}</TableCell>
                                    <TableCell className="text-center">
                                        {u.step1 ? <CheckCircle2 className="mx-auto h-4 w-4 text-green-500" /> : <Circle className="mx-auto h-4 w-4 text-slate-200" />}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {u.step2 === null ? <span className="text-slate-300">-</span> : (u.step2 ? <CheckCircle2 className="mx-auto h-4 w-4 text-purple-500" /> : <Circle className="mx-auto h-4 w-4 text-slate-200" />)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {u.step3 === null ? <span className="text-slate-300">-</span> : (u.step3 ? <CheckCircle2 className="mx-auto h-4 w-4 text-blue-500" /> : <Circle className="mx-auto h-4 w-4 text-slate-200" />)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
