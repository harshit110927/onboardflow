"use client";

import { useState } from "react";

const AVAILABLE_EVENTS = [
  { value: "user.activated", label: "User Activated" },
  { value: "user.stuck", label: "User Stuck" },
  { value: "user.identified", label: "User Identified" },
  { value: "*", label: "All Events" },
];

type Webhook = {
  id: number;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date | null;
};

type Delivery = {
  id: number;
  webhookId: number;
  eventType: string;
  responseStatus: number | null;
  success: boolean;
  deliveredAt: Date | null;
};

export function WebhooksManager({
  initialWebhooks,
  recentDeliveries,
}: {
  initialWebhooks: Webhook[];
  recentDeliveries: Delivery[];
}) {
  const [webhooks, setWebhooks] = useState<Webhook[]>(initialWebhooks);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<number | null>(null);

  function toggleEvent(value: string) {
    setSelectedEvents((e) =>
      e.includes(value) ? e.filter((x) => x !== value) : [...e, value]
    );
  }

  async function handleAdd() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/individual/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: selectedEvents }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setWebhooks((w) => [...w, data.webhook]);
      setUrl("");
      setSelectedEvents([]);
      setShowForm(false);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this webhook?")) return;
    setLoading(true);
    try {
      await fetch("/api/individual/webhooks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setWebhooks((w) => w.filter((wh) => wh.id !== id));
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Existing webhooks */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Endpoints ({webhooks.length} / 5)
          </h2>
          {webhooks.length < 5 && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="text-sm rounded-md bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90 transition-opacity"
            >
              + Add Endpoint
            </button>
          )}
        </div>

        {showForm && (
          <div className="px-6 py-5 border-b border-border flex flex-col gap-4 bg-secondary/20">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Endpoint URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourapp.com/webhooks/dripmetric"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Events to receive</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_EVENTS.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => toggleEvent(e.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selectedEvents.includes(e.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAdd}
                disabled={loading || !url || selectedEvents.length === 0}
                className="text-sm rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {loading ? "Adding..." : "Add Endpoint"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {webhooks.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No webhook endpoints yet. Add one above.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {webhooks.map((wh) => (
              <div key={wh.id} className="px-6 py-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-sm font-mono text-foreground truncate">{wh.url}</p>
                    <div className="flex flex-wrap gap-1">
                      {wh.events.map((e) => (
                        <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(wh.id)}
                    disabled={loading}
                    className="text-xs text-destructive hover:opacity-70 transition-opacity shrink-0"
                  >
                    Delete
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground font-mono">
                    Secret: {revealedSecret === wh.id ? wh.secret : "••••••••••••••••"}
                  </p>
                  <button
                    onClick={() => setRevealedSecret(revealedSecret === wh.id ? null : wh.id)}
                    className="text-xs text-primary underline"
                  >
                    {revealedSecret === wh.id ? "Hide" : "Reveal"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery log */}
      {recentDeliveries.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Recent Deliveries</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Event</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentDeliveries.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{d.eventType}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      d.success
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-destructive/10 text-destructive"
                    }`}>
                      {d.success ? `${d.responseStatus} OK` : `${d.responseStatus || "Failed"}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {d.deliveredAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}