"use client"; 

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner"; // Ensure you installed sonner earlier

interface ApiKeyCardProps {
    apiKey: string | null;
}

export function ApiKeyCard({ apiKey }: ApiKeyCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!apiKey) return;
    
    // This is the Browser API that failed before
    navigator.clipboard.writeText(apiKey);
    
    setCopied(true);
    toast.success("API Key copied to clipboard");

    setTimeout(() => setCopied(false), 2000);
  };

  const maskedKey = apiKey 
    ? `${apiKey.substring(0, 12)}****************************` 
    : "No API Key Generated";

  return (
    <Card className="bg-slate-900 text-white">
        <CardHeader>
            <CardTitle className="text-slate-200">Your API Key</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-md font-mono text-sm border border-slate-700">
                <span className="truncate mr-4 text-slate-300">
                    {maskedKey}
                </span>
                
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleCopy}
                    className="text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                >
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
                Do not share this key. It grants access to your user database.
            </p>
        </CardContent>
    </Card>
  );
}