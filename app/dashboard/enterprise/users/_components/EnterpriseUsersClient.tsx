"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type UserStatus = "activated" | "stalled" | "at_risk" | "churned";
type StatusFilter = "all" | UserStatus;
type SortKey =
  | "email"
  | "customerType"
  | "plan"
  | "currentStep"
  | "lastSeenAt"
  | "status"
  | "emailsSent";
type SortDirection = "asc" | "desc";

type EndUserProperties = {
  customerType?: string | null;
  plan?: string | null;
  planValue?: number | string | null;
  currency?: string | null;
  [key: string]: unknown;
} | null;

type ApiEndUser = {
  userId: string;
  email: string;
  properties: EndUserProperties;
  completedSteps: string[];
  lastSeenAt: string | null;
  lastEmailedAt: string | null;
  automationsReceived: string[];
  createdAt: string;
  status: UserStatus;
};

type UsersResponse = {
  success: true;
  users: ApiEndUser[];
  total: number;
  page: number;
  limit: number;
};

type ErrorResponse = {
  success: false;
  error: {
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

function getCurrentStep(user: ApiEndUser) {
  return user.completedSteps[user.completedSteps.length - 1] ?? "None";
}

function getEmailsSent(user: ApiEndUser) {
  return user.automationsReceived.length;
}

function getPlanValue(user: ApiEndUser) {
  const rawValue = user.properties?.planValue;
  if (typeof rawValue === "number") return rawValue;
  if (typeof rawValue === "string") {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getCurrencySymbol(currency?: string | null) {
  switch (currency?.toUpperCase()) {
    case "INR":
      return "₹";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "USD":
    default:
      return "$";
  }
}

function getPlanLabel(user: ApiEndUser) {
  const plan = user.properties?.plan;
  const planValue = getPlanValue(user);

  if (!plan && planValue === null) return "—";

  const parts = [];
  if (plan) parts.push(plan);
  if (planValue !== null) {
    parts.push(`${getCurrencySymbol(user.properties?.currency)}${planValue}/mo`);
  }

  return parts.join(" · ");
}

function formatRelativeTime(value: string | null) {
  if (!value) return "Never";

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Never";

  const diffMs = Date.now() - timestamp;
  if (diffMs < 60_000) return "Just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function getCustomerTypeClasses(customerType?: string | null) {
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

function getStatusClasses(status: UserStatus) {
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

function getSortValue(user: ApiEndUser, sortKey: SortKey) {
  switch (sortKey) {
    case "email":
      return user.email.toLowerCase();
    case "customerType":
      return user.properties?.customerType ?? "free";
    case "plan":
      return getPlanLabel(user).toLowerCase();
    case "currentStep":
      return getCurrentStep(user).toLowerCase();
    case "lastSeenAt":
      return user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
    case "status":
      return statusOrder[user.status];
    case "emailsSent":
      return getEmailsSent(user);
  }
}

function escapeCsv(value: string | number | null) {
  const stringValue = value === null ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function toCsv(users: ApiEndUser[]) {
  const headers = [
    "email",
    "customerType",
    "plan",
    "planValue",
    "currentStep",
    "lastSeenAt",
    "status",
    "emailsSent",
  ];
  const rows = users.map((user) => [
    user.email,
    user.properties?.customerType ?? "free",
    user.properties?.plan ?? "",
    getPlanValue(user),
    getCurrentStep(user),
    user.lastSeenAt,
    user.status,
    getEmailsSent(user),
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
    .join("\n");
}

function SortableHead({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey | null;
  direction: SortDirection;
  onSort: (sortKey: SortKey) => void;
}) {
  const isActive = activeSortKey === sortKey;

  return (
    <TableHead>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left font-semibold hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className="text-[10px] text-muted-foreground">
          {isActive ? (direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </TableHead>
  );
}

export function EnterpriseUsersClient({ apiKey }: { apiKey: string }) {
  const [users, setUsers] = useState<ApiEndUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchUsers() {
      if (!apiKey) {
        setError("No API key is available for this tenant.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const res = await fetch(`/api/v1/users?page=${page}&limit=${PAGE_SIZE}`, {
        headers: { "x-api-key": apiKey },
      });
      const json = (await res.json()) as UsersResponse | ErrorResponse;

      if (!active) return;

      if (!res.ok || !json.success) {
        setError(json.success ? "Unable to load users." : json.error.message);
        setUsers([]);
        setTotal(0);
      } else {
        setUsers(json.users);
        setTotal(json.total);
      }
      setLoading(false);
    }

    fetchUsers();

    return () => {
      active = false;
    };
  }, [apiKey, page]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const visibleUsers = users.filter((user) => {
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      const matchesSearch = !normalizedSearch || user.email.toLowerCase().includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });

    return [...visibleUsers].sort((a, b) => {
      if (!sortKey) return statusOrder[a.status] - statusOrder[b.status];

      const aValue = getSortValue(a, sortKey);
      const bValue = getSortValue(b, sortKey);
      const comparison = typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue));

      return sortDirection === "asc" ? comparison : comparison * -1;
    });
  }, [search, sortDirection, sortKey, statusFilter, users]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("asc");
  };

  const handleDownloadCsv = async () => {
    if (!apiKey) return;

    setExporting(true);
    const res = await fetch("/api/v1/users?limit=200", {
      headers: { "x-api-key": apiKey },
    });
    const json = (await res.json()) as UsersResponse | ErrorResponse;
    setExporting(false);

    if (!res.ok || !json.success) {
      setError(json.success ? "Unable to export users." : json.error.message);
      return;
    }

    const blob = new Blob([toCsv(json.users)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dripmetric-users.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Users</h1>
            <p className="mt-1 text-muted-foreground">
              View tracked end users, lifecycle status, customer details, and nudge history.
            </p>
          </div>
          <Button onClick={handleDownloadCsv} disabled={exporting || loading || !apiKey}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download CSV
          </Button>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>End-user CRM</CardTitle>
              <CardDescription>
                Showing {filteredUsers.length} visible user{filteredUsers.length === 1 ? "" : "s"} on page {page} of {totalPages} · {total} total.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={statusFilter} defaultValue="all" onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <TabsList className="flex-wrap justify-start h-auto">
                  {(Object.keys(statusLabels) as StatusFilter[]).map((status) => (
                    <TabsTrigger key={status} value={status}>
                      {statusLabels[status]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="relative w-full lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by email"
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Email" sortKey="email" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHead label="Customer type" sortKey="customerType" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHead label="Plan" sortKey="plan" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHead label="Current step" sortKey="currentStep" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHead label="Last active" sortKey="lastSeenAt" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHead label="Status" sortKey="status" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <SortableHead label="Emails sent" sortKey="emailsSent" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
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
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getCustomerTypeClasses(customerType)}>
                              {customerType}
                            </Badge>
                          </TableCell>
                          <TableCell>{getPlanLabel(user)}</TableCell>
                          <TableCell>{getCurrentStep(user)}</TableCell>
                          <TableCell>{formatRelativeTime(user.lastSeenAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusClasses(user.status)}>
                              {statusLabels[user.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>{getEmailsSent(user)}</TableCell>
                          <TableCell>
                            {/* TODO: Wire this to a per-user nudge endpoint once one exists; /api/v1/nudge-step currently nudges all eligible users for a step. */}
                            <Button variant="outline" size="sm" disabled>
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
                Page {page} of {totalPages} · {total} total users
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
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
