"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/utils/time";

const STAGES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
  { key: "closed", label: "Closed" },
] as const;

type Stage = (typeof STAGES)[number]["key"];
type PipelineContact = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  customFields: Record<string, string>;
  pipelineStage: Stage;
  followUpAt: string | null;
  followUpSent: boolean;
  tags: { id: number; name: string; color: string }[];
  lastActivity: string | null;
};
type PipelineData = { [K in Stage]: PipelineContact[] } & { lists: { id: number; name: string }[] };

export default function PipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState("");
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null);

  useEffect(() => {
    const loadPipeline = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/individual/pipeline${selectedListId ? `?listId=${selectedListId}` : ""}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load pipeline");
        setData(json);
      } catch (err) {
        setError("Failed to load pipeline");
        toast.error("Failed to load pipeline");
      } finally {
        setLoading(false);
      }
    };

    loadPipeline();
  }, [selectedListId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="rounded-lg border border-border p-3">
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-16 mb-2" />
              <Skeleton className="h-16 mb-2" />
              <Skeleton className="h-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
          <select
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All lists</option>
            {data?.lists.map((list) => (
              <option key={list.id} value={String(list.id)}>{list.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-4 md:flex-row flex-col">
          {STAGES.map((stage) => (
            <div key={stage.key} className="flex-1 min-w-0">
              <div className="rounded-lg border border-border bg-card h-full">
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                  <p className="text-sm font-medium">{stage.label}</p>
                  <Badge variant="secondary">{data?.[stage.key].length ?? 0}</Badge>
                </div>

                <div
                  className={`p-2 ${dragOverStage === stage.key ? "ring-2 ring-blue-400" : ""}`}
                  style={{ maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOverStage(stage.key);
                  }}
                  onDragLeave={() => setDragOverStage(null)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDragOverStage(null);
                    const raw = e.dataTransfer.getData("text/plain");
                    if (!raw || !data) return;

                    const { contactId, fromStage } = JSON.parse(raw) as { contactId: number; fromStage: Stage };
                    const targetStage = stage.key;
                    if (fromStage === targetStage) return;

                    setData((prev) => {
                      if (!prev) return prev;
                      const contact = prev[fromStage].find((c) => c.id === contactId);
                      if (!contact) return prev;
                      return {
                        ...prev,
                        [fromStage]: prev[fromStage].filter((c) => c.id !== contactId),
                        [targetStage]: [{ ...contact, pipelineStage: targetStage }, ...prev[targetStage]],
                      };
                    });

                    try {
                      const res = await fetch("/api/individual/pipeline", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ contactId, stage: targetStage }),
                      });
                      if (!res.ok) throw new Error("Failed");
                      toast.success("Pipeline stage updated");
                    } catch {
                      setData((prev) => {
                        if (!prev) return prev;
                        const contact = prev[targetStage].find((c) => c.id === contactId);
                        if (!contact) return prev;
                        return {
                          ...prev,
                          [targetStage]: prev[targetStage].filter((c) => c.id !== contactId),
                          [fromStage]: [{ ...contact, pipelineStage: fromStage }, ...prev[fromStage]],
                        };
                      });
                      toast.error("Failed to update pipeline stage");
                    }
                  }}
                >
                  {(data?.[stage.key] ?? []).map((contact) => (
                    <div
                      key={contact.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", JSON.stringify({ contactId: contact.id, fromStage: stage.key }));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="bg-white dark:bg-gray-800 shadow-sm rounded-md p-3 mb-2 cursor-grab"
                    >
                      <p className="font-medium text-sm">{contact.name}</p>
                      {contact.customFields?.company ? <p className="text-xs text-muted-foreground">{contact.customFields.company}</p> : null}

                      <div className="mt-1 flex flex-wrap gap-1">
                        {contact.tags.map((tag) => (
                          <span key={tag.id} style={{ backgroundColor: `${tag.color}33`, color: tag.color, fontSize: 11, padding: "2px 7px", borderRadius: 9999 }}>
                            {tag.name}
                          </span>
                        ))}
                      </div>

                      {contact.followUpAt && !contact.followUpSent ? (
                        <p className="text-xs text-amber-600 mt-1">
                          🔔 {new Date(contact.followUpAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      ) : null}

                      <p className="text-xs text-muted-foreground text-right mt-2">
                        {contact.lastActivity ? formatRelativeTime(new Date(contact.lastActivity)) : "No activity"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
