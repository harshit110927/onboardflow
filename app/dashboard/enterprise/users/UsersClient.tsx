"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type UserStatus = "activated" | "stalled" | "at_risk" | "churned";
type StatusFilter = "all" | UserStatus;
type SortKey = "email" | "customerType" | "plan" | "currentStep" | "lastSeenAt" | "status" | "emailsSent";
type SortDirection = "asc" | "desc";

type UserProperties = {
  customerType?: string;
  plan?: string;
  planValue?: number | string;
  currency?: string;
  currencySymbol?: string;
  [key: string]: unknown;
};

type ApiUser = {
  userId: string;
  email: string;
  properties: UserProperties | null;
  completedSteps: string[];
  lastSeenAt: string | null;
  lastEmailedAt: string | null;
  automationsReceived: string[];
  createdAt: string;
  status: UserStatus;
};

type UsersResponse = {
  success: boolean;
  users?: ApiUser[];
  total?: number;
  page?: number;
  limit?: number;
  error?: {
    code: string;
    message: string;
  };
};

const PAGE_SIZE = 50;
const statusOrder: Record<UserStatus, number> = {
  stalled: 0,
  at_risk: 1,
  activated: 2,
  churned: 3,
};

const statusLabels: Record<StatusFilter, string> = {
  all: "All",
  stalled: "Stalled",
  at_risk: "At-Risk",
  activated: "Activated",
  churned: "Churned",
};

const statusFilters: StatusFilter[] = ["all", "stalled", "at_risk", "activated", "churned"];

function formatStatus(status: UserStatus) {
  return statusLabels[status];
}

function customerTypeClasses(customerType?: string) {
  switch (customerType) {
    case "paying":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "trial":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "churned":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "free":
    default:
      return "border-white/10 bg-white/10 text-white/70";
  }
}

function statusClasses(status: UserStatus) {
  switch (status) {
    case "activated":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "stalled":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "at_risk":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "churned":
      return "border-white/10 bg-white/10 text-white/70";
  }
}

function currencySymbol(properties: UserProperties | null) {
  if (typeof properties?.currencySymbol === "string" && properties.currencySymbol) return properties.currencySymbol;

  const currency = typeof properties?.currency === "string" ? properties.currency.toUpperCase() : "USD";
  if (currency === "INR") return "₹";
  if (currency === "EUR") return "€";
  if (currency === "GBP") return "£";
  return "$";
}

function formatPlan(properties: UserProperties | null) {
  const plan = properties?.plan;
  const planValue = properties?.planValue;

  if (!plan && (planValue === undefined || planValue === null || planValue === "")) return "—";

  const parts = [];
  if (plan) parts.push(String(plan));
  if (planValue !== undefined && planValue !== null && planValue !== "") {
    parts.push(`${currencySymbol(properties)}${planValue}/mo`);
  }

  return parts.join(" · ");
}

function currentStep(user: ApiUser) {
  return user.completedSteps.at(-1) ?? "None";
}

function relativeTime(value: string | null) {
  if (!value) return "Never";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Never";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return "just now";

  const units = [
    { label: "year", seconds: 365 * 24 * 60 * 60 },
    { label: "month", seconds: 30 * 24 * 60 * 60 },
    { label: "day", seconds: 24 * 60 * 60 },
    { label: "hour", seconds: 60 * 60 },
    { label: "minute", seconds: 60 },
  ];

  const unit = units.find((item) => diffSeconds >= item.seconds) ?? units[units.length - 1];
  const count = Math.floor(diffSeconds / unit.seconds);
  return `${count} ${unit.label}${count === 1 ? "" : "s"} ago`;
}

function escapeCsvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(users: ApiUser[]) {
  const rows = users.map((user) => ({
    email: user.email,
    customerType: user.properties?.customerType ?? "",
    plan: user.properties?.plan ?? "",
    planValue: user.properties?.planValue ?? "",
    currentStep: currentStep(user) === "None" ? "" : currentStep(user),
    lastSeenAt: user.lastSeenAt ?? "",
    status: user.status,
    emailsSent: user.automationsReceived.length,
  }));

  const headers = ["email", "customerType", "plan", "planValue", "currentStep", "lastSeenAt", "status", "emailsSent"];
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header as keyof typeof row])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dripmetric-users-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function sortValue(user: ApiUser, key: SortKey) {
  switch (key) {
    case "email":
      return user.email.toLowerCase();
    case "customerType":
      return user.properties?.customerType ?? "free";
    case "plan":
      return formatPlan(user.properties);
    case "currentStep":
      return currentStep(user);
    case "lastSeenAt":
      return user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
    case "status":
      return statusOrder[user.status];
    case "emailsSent":
      return user.automationsReceived.length;
  }
}

function compareValues(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function SortableHead({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;

  return (
    <TableHead className={className}>
      <button
        type="button"
        className="flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className={cn("text-[10px]", active ? "text-primary" : "text-muted-foreground/50")}>
          {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </TableHead>
  );
}

export function UsersClient({ apiKey }: { apiKey: string | null }) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  useEffect(() => {
    if (!apiKey) {
      setError("No API key found for this tenant.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const key = apiKey;

    async function fetchUsers() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/users?page=${page}&limit=${PAGE_SIZE}`, {
          headers: {
            "x-api-key": key,
          },
        });
        const json = (await response.json()) as UsersResponse;

        if (!response.ok || !json.success) {
          throw new Error(json.error?.message ?? "Unable to load users");
        }

        if (!cancelled) {
          setUsers(json.users ?? []);
          setTotal(json.total ?? 0);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load users");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUsers();

    return () => {
      cancelled = true;
    };
  }, [apiKey, page]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const nextUsers = users.filter((user) => {
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      const matchesSearch = !normalizedSearch || user.email.toLowerCase().includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });

    return [...nextUsers].sort((a, b) => {
      if (!sortKey) return statusOrder[a.status] - statusOrder[b.status];

      const result = compareValues(sortValue(a, sortKey), sortValue(b, sortKey));
      return sortDirection === "asc" ? result : -result;
    });
  }, [search, sortDirection, sortKey, statusFilter, users]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("asc");
  }

  async function handleDownloadCsv() {
    if (!apiKey) return;

    const key = apiKey;
    setExporting(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/users?limit=200", {
        headers: {
          "x-api-key": key,
        },
      });
      const json = (await response.json()) as UsersResponse;

      if (!response.ok || !json.success) {
        throw new Error(json.error?.message ?? "Unable to export users");
      }

      downloadCsv(json.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export users");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Users</h1>
            <p className="text-muted-foreground">
              Search, segment, and export the end users tracked through your Dripmetric API.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={handleDownloadCsv} disabled={exporting || !apiKey}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download CSV
          </Button>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>End users</CardTitle>
                <CardDescription>
                  Showing page {page} of {totalPages} · {total} total users
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by email"
                  className="pl-9"
                />
              </div>
            </div>

            <Tabs value={statusFilter} defaultValue="all" onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <TabsList className="flex-wrap justify-start">
                {statusFilters.map((status) => (
                  <TabsTrigger key={status} value={status}>
                    {statusLabels[status]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Email" sortKey="email" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHead label="Customer type" sortKey="customerType" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHead label="Plan" sortKey="plan" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHead label="Current step" sortKey="currentStep" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHead label="Last active" sortKey="lastSeenAt" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHead label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHead label="Emails sent" sortKey="emailsSent" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="text-right" />
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        No users match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const customerType = user.properties?.customerType ?? "free";

                      return (
                        <TableRow key={user.userId}>
                          <TableCell className="font-medium">{user.email || user.userId}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={customerTypeClasses(customerType)}>
                              {customerType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatPlan(user.properties)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{currentStep(user)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{relativeTime(user.lastSeenAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusClasses(user.status)}>
                              {formatStatus(user.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {user.automationsReceived.length}
                          </TableCell>
                          <TableCell className="text-right">
                            {/* TODO: Wire this to a per-user nudge endpoint once the API supports targeting a specific user. */}
                            <Button type="button" variant="outline" size="sm" disabled title="Per-user nudges are not implemented yet">
                              Send nudge
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages} · showing {filteredUsers.length} of {users.length} loaded rows
              </span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>
                  Previous
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
