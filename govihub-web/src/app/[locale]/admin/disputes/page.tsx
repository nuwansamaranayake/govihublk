"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

// ── Types ────────────────────────────────────────────────────────────────────
type DisputeStatus = "open" | "investigating" | "resolved" | "dismissed";

interface Dispute {
  id: string;
  match_id: string;
  farmer_name: string;
  buyer_name: string;
  crop: string;
  status: DisputeStatus;
  reported_at: string;
  reason?: string;
  resolution?: string;
}

// ── Mock data (empty by default to show EmptyState) ─────────────────────────
const MOCK_DISPUTES: Dispute[] = [];

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<DisputeStatus, { label: string; color: "blue" | "gold" | "green" | "gray" | "red" }> = {
  open: { label: "Open", color: "red" },
  investigating: { label: "Investigating", color: "gold" },
  resolved: { label: "Resolved", color: "green" },
  dismissed: { label: "Dismissed", color: "gray" },
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
];

// ── Component ────────────────────────────────────────────────────────────────
export default function AdminDisputesPage() {
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get<Dispute[]>("/admin/disputes");
        setDisputes(res);
      } catch {
        setDisputes(MOCK_DISPUTES);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleAction = async (disputeId: string, action: "investigate" | "resolve" | "dismiss") => {
    setActionLoading(disputeId);
    const statusMap: Record<string, DisputeStatus> = {
      investigate: "investigating",
      resolve: "resolved",
      dismiss: "dismissed",
    };
    try {
      await api.post(`/admin/disputes/${disputeId}/${action}`);
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === disputeId ? { ...d, status: statusMap[action] } : d
        )
      );
    } catch {
      // Optimistic update even on API failure (mock mode)
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === disputeId ? { ...d, status: statusMap[action] } : d
        )
      );
    } finally {
      setActionLoading(null);
    }
  };

  const filtered =
    statusFilter === "all"
      ? disputes
      : disputes.filter((d) => d.status === statusFilter);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-LK", { month: "short", day: "numeric", year: "numeric" });

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Disputes</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage and resolve marketplace disputes
          </p>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState
            title="No disputes — great news!"
            description="There are no disputes to review at this time. The marketplace is running smoothly."
            icon={
              <svg className="w-16 h-16 text-green-300 mx-auto" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 24l5 5 11-11" />
              </svg>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-600">Match ID</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Farmer</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Buyer</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Crop</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Reported</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((dispute) => {
                  const cfg = STATUS_CONFIG[dispute.status];
                  return (
                    <tr
                      key={dispute.id}
                      className="border-b border-neutral-100 hover:bg-neutral-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                        {dispute.match_id.slice(0, 12)}...
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-800">
                        {dispute.farmer_name}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{dispute.buyer_name}</td>
                      <td className="px-4 py-3 text-neutral-700">{dispute.crop}</td>
                      <td className="px-4 py-3">
                        <Badge color={cfg.color} size="sm" dot>
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">
                        {formatDate(dispute.reported_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {dispute.status === "open" && (
                            <button
                              onClick={() => handleAction(dispute.id, "investigate")}
                              disabled={actionLoading === dispute.id}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                            >
                              Investigate
                            </button>
                          )}
                          {(dispute.status === "open" || dispute.status === "investigating") && (
                            <>
                              <button
                                onClick={() => handleAction(dispute.id, "resolve")}
                                disabled={actionLoading === dispute.id}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
                              >
                                Resolve
                              </button>
                              <button
                                onClick={() => handleAction(dispute.id, "dismiss")}
                                disabled={actionLoading === dispute.id}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-50 text-neutral-600 border border-neutral-200 hover:bg-neutral-100 transition-colors disabled:opacity-50"
                              >
                                Dismiss
                              </button>
                            </>
                          )}
                          {(dispute.status === "resolved" || dispute.status === "dismissed") && (
                            <span className="text-xs text-neutral-400 italic">Closed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
