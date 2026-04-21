"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cropName, formatDateSafe } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

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

/* eslint-disable @typescript-eslint/no-explicit-any */
interface MatchDetail {
  id: string;
  score: number;
  score_breakdown: Record<string, number> | null;
  status: string;
  agreed_price_per_kg: number | null;
  agreed_quantity_kg: number | null;
  notes: string | null;
  created_at: string | null;
  farmer_name: string;
  farmer_phone: string | null;
  farmer_district: string | null;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_district: string | null;
  crop_name: string;
  crop_name_si: string | null;
  crop_category: string | null;
  harvest_quantity_kg: number | null;
  harvest_price_per_kg: number | null;
  harvest_quality_grade: string | null;
  harvest_date: string | null;
  harvest_is_organic: boolean;
  demand_quantity_kg: number | null;
  demand_max_price_per_kg: number | null;
  demand_needed_by: string | null;
  [key: string]: any;
}

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
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { isReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);

  useEffect(() => {
    if (!isReady) return;
    async function fetchData() {
      try {
        const res = await api.get<Dispute[]>("/admin/disputes");
        setDisputes(res);
      } catch {
        // Fallback: try to get disputed matches from the matches endpoint
        try {
          const matches = await api.get<Array<{
            id: string;
            farmer_name: string;
            buyer_name: string;
            crop: string;
            status: string;
            created_at: string;
            reason?: string;
          }>>("/admin/matches?status=disputed");
          const disputesFromMatches: Dispute[] = matches
            .filter((m) => m.status === "disputed")
            .map((m) => ({
              id: `dispute-${m.id}`,
              match_id: m.id,
              farmer_name: m.farmer_name,
              buyer_name: m.buyer_name,
              crop: m.crop,
              status: "open" as DisputeStatus,
              reported_at: m.created_at,
              reason: m.reason,
            }));
          setDisputes(disputesFromMatches);
        } catch {
          setDisputes([]);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [isReady]);

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
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === disputeId ? { ...d, status: statusMap[action] } : d
        )
      );
    } finally {
      setActionLoading(null);
    }
  };

  const openDetail = async (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setDetailOpen(true);
    setDetailLoading(true);
    setMatchDetail(null);
    try {
      // Use the real match_id (strip dispute- prefix if present)
      const matchId = dispute.match_id.replace(/^dispute-/, "");
      const detail = await api.get<MatchDetail>(`/admin/matches/${matchId}/enriched`);
      setMatchDetail(detail);
    } catch {
      setMatchDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered =
    statusFilter === "all"
      ? disputes
      : disputes.filter((d) => d.status === statusFilter);

  const formatDate = (d: string) => formatDateSafe(d);

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
                      <td className="px-4 py-3 text-neutral-700">{cropName(dispute.crop, locale)}</td>
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
                          <button
                            onClick={() => openDetail(dispute)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                          >
                            Details
                          </button>
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

      {/* Detail Modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Dispute Details"
        size="lg"
        footer={
          <Button variant="secondary" fullWidth onClick={() => setDetailOpen(false)}>
            Close
          </Button>
        }
      >
        {detailLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Dispute info */}
            {selectedDispute && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Dispute #{selectedDispute.id?.slice(0, 8)}
                    </p>
                    <Badge color={STATUS_CONFIG[selectedDispute.status]?.color || "gray"} size="sm" dot>
                      {STATUS_CONFIG[selectedDispute.status]?.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Reported: {formatDate(selectedDispute.reported_at)}
                  </p>
                </div>
                {selectedDispute.reason && (
                  <div className="mt-3 bg-white/60 rounded-lg p-2.5">
                    <p className="text-xs font-medium text-red-700 mb-0.5">Reason</p>
                    <p className="text-sm text-neutral-700">{selectedDispute.reason}</p>
                  </div>
                )}
                {selectedDispute.resolution && (
                  <div className="mt-2 bg-white/60 rounded-lg p-2.5">
                    <p className="text-xs font-medium text-green-700 mb-0.5">Resolution</p>
                    <p className="text-sm text-neutral-700">{selectedDispute.resolution}</p>
                  </div>
                )}
              </div>
            )}

            {/* Parties */}
            {matchDetail ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">Farmer (Seller)</p>
                    <p className="text-sm font-semibold text-neutral-800">{matchDetail.farmer_name}</p>
                    {matchDetail.farmer_district && (
                      <p className="text-xs text-neutral-500 mt-0.5">📍 {matchDetail.farmer_district}</p>
                    )}
                    {matchDetail.farmer_phone && (
                      <p className="text-xs text-neutral-500 mt-0.5">📞 {matchDetail.farmer_phone}</p>
                    )}
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Buyer</p>
                    <p className="text-sm font-semibold text-neutral-800">{matchDetail.buyer_name}</p>
                    {matchDetail.buyer_district && (
                      <p className="text-xs text-neutral-500 mt-0.5">📍 {matchDetail.buyer_district}</p>
                    )}
                    {matchDetail.buyer_phone && (
                      <p className="text-xs text-neutral-500 mt-0.5">📞 {matchDetail.buyer_phone}</p>
                    )}
                  </div>
                </div>

                {/* Match info */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Related Match</p>
                    <span className="text-lg font-bold text-blue-800">{Math.round((matchDetail.score || 0) * 100)}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-neutral-500">Crop: </span>
                      <span className="font-medium">{matchDetail.crop_name}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Status: </span>
                      <span className="font-medium capitalize">{matchDetail.status}</span>
                    </div>
                    {matchDetail.harvest_quantity_kg && (
                      <div>
                        <span className="text-neutral-500">Supply: </span>
                        <span className="font-medium">{matchDetail.harvest_quantity_kg} kg</span>
                      </div>
                    )}
                    {matchDetail.demand_quantity_kg && (
                      <div>
                        <span className="text-neutral-500">Demand: </span>
                        <span className="font-medium">{matchDetail.demand_quantity_kg} kg</span>
                      </div>
                    )}
                    {matchDetail.harvest_price_per_kg && (
                      <div>
                        <span className="text-neutral-500">Ask Price: </span>
                        <span className="font-medium text-green-700">Rs. {matchDetail.harvest_price_per_kg}/kg</span>
                      </div>
                    )}
                    {matchDetail.demand_max_price_per_kg && (
                      <div>
                        <span className="text-neutral-500">Max Price: </span>
                        <span className="font-medium text-amber-700">Rs. {matchDetail.demand_max_price_per_kg}/kg</span>
                      </div>
                    )}
                  </div>
                </div>

                {matchDetail.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Admin Notes</p>
                    <p className="text-sm text-neutral-700">{matchDetail.notes}</p>
                  </div>
                )}
              </>
            ) : (
              /* Fallback when match detail unavailable */
              selectedDispute && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">Farmer</p>
                    <p className="text-sm font-semibold text-neutral-800">{selectedDispute.farmer_name}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Buyer</p>
                    <p className="text-sm font-semibold text-neutral-800">{selectedDispute.buyer_name}</p>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
