"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { pluralize } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { formatStatus, cropName, formatDateSafe } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

type MatchStatus = "proposed" | "accepted" | "completed" | "dismissed";

interface Match {
  id: string;
  farmerName: string;
  buyerName: string;
  crop: string;
  quantity: number;
  unit: string;
  price: number;
  score: number;
  status: MatchStatus;
  createdAt: string;
  notes?: string;
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
  confirmed_at: string | null;
  fulfilled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  farmer_id: string | null;
  farmer_name: string;
  farmer_phone: string | null;
  farmer_district: string | null;
  buyer_id: string | null;
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
  harvest_district: string | null;
  harvest_description: string | null;
  harvest_is_organic: boolean;
  harvest_status: string | null;
  demand_quantity_kg: number | null;
  demand_max_price_per_kg: number | null;
  demand_quality_grade: string | null;
  demand_needed_by: string | null;
  demand_district: string | null;
  demand_description: string | null;
  demand_status: string | null;
}

const STATUS_COLOR: Record<MatchStatus, "blue" | "gold" | "green" | "gray"> = {
  proposed: "blue",
  accepted: "gold",
  completed: "green",
  dismissed: "gray",
};

export default function AdminMatchesPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { isReady } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Match | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [resolveAction, setResolveAction] = useState<"completed" | "dismissed">("completed");
  const [resolving, setResolving] = useState(false);
  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);

  useEffect(() => {
    if (!isReady) return;
    api.get<Match[] | { items: Match[] }>("/admin/matches")
      .then((data) => setMatches(Array.isArray(data) ? data : (data?.items ?? [])))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [isReady]);

  const openResolve = (match: Match) => {
    setSelected(match);
    setResolution("");
    setResolveOpen(true);
  };

  const openDetail = async (match: Match) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setMatchDetail(null);
    try {
      const detail = await api.get<MatchDetail>(`/admin/matches/${match.id}/enriched`);
      setMatchDetail(detail);
    } catch {
      // Fallback to basic match data
      setMatchDetail({
        id: match.id,
        score: match.score,
        score_breakdown: null,
        status: match.status,
        agreed_price_per_kg: match.price || null,
        agreed_quantity_kg: match.quantity || null,
        notes: match.notes || null,
        confirmed_at: null, fulfilled_at: null,
        created_at: match.createdAt, updated_at: null,
        farmer_id: null, farmer_name: match.farmerName || "Unknown",
        farmer_phone: null, farmer_district: null,
        buyer_id: null, buyer_name: match.buyerName || "Unknown",
        buyer_phone: null, buyer_district: null,
        crop_name: match.crop || "Unknown", crop_name_si: null, crop_category: null,
        harvest_quantity_kg: null, harvest_price_per_kg: null,
        harvest_quality_grade: null, harvest_date: null,
        harvest_district: null, harvest_description: null,
        harvest_is_organic: false, harvest_status: null,
        demand_quantity_kg: null, demand_max_price_per_kg: null,
        demand_quality_grade: null, demand_needed_by: null,
        demand_district: null, demand_description: null, demand_status: null,
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selected || !resolution.trim()) return;
    setResolving(true);
    try {
      await api.post(`/admin/matches/${selected.id}/resolve`, {
        action: resolveAction,
        resolution: resolution,
        new_status: resolveAction,
      });
      setMatches(prev => prev.map(m => m.id === selected.id ? { ...m, status: resolveAction } : m));
      setResolveOpen(false);
    } catch {
      setResolveOpen(false);
    } finally { setResolving(false); }
  };

  const scoreColor = (s: number) => {
    const pct = s <= 1 ? s * 100 : s;
    return pct >= 85 ? "text-green-600" : pct >= 70 ? "text-amber-500" : "text-red-500";
  };

  const allStatuses: MatchStatus[] = ["proposed", "accepted", "completed", "dismissed"];
  const tabs = [
    { key: "all", label: "All", badge: matches.length },
    ...allStatuses.map(s => ({
      key: s, label: formatStatus(s),
      badge: matches.filter(m => m.status === s).length,
    })),
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      <div className="bg-neutral-800 px-6 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">Match Management</h1>
        <p className="text-neutral-300 text-sm mt-1">{matches.length} total matches</p>
      </div>

      {/* Search */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <Input placeholder="Search by farmer, buyer, or crop..." value={search}
          onChange={e => setSearch(e.target.value)} leftIcon={<span>🔍</span>} />
      </div>

      <Tabs tabs={tabs} defaultTab="all">
        {(activeTab) => {
          const filtered = matches
            .filter(m => activeTab === "all" || m.status === activeTab)
            .filter(m => !search || m.farmerName?.toLowerCase().includes(search.toLowerCase()) || m.buyerName?.toLowerCase().includes(search.toLowerCase()) || cropName(m.crop, locale)?.toLowerCase().includes(search.toLowerCase()));
          return (
            <div className="px-4 py-4 space-y-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                    <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" />
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <EmptyState icon="🤝" title="No matches found" />
              ) : (
                filtered.map(match => (
                  <Card key={match.id} padding="md">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge color={STATUS_COLOR[match.status] || "gray"} size="sm" dot>{formatStatus(match.status)}</Badge>
                          <span className="text-xs text-neutral-400">#{match.id?.slice(0, 8)}</span>
                        </div>
                        <p className="text-sm font-semibold text-neutral-900 mt-1">
                          Score: {Math.round((match.score || 0) * 100)}%
                        </p>
                        <p className="text-xs text-neutral-600 mt-0.5">
                          {match.price ? `Rs. ${match.price}/kg` : "Price TBD"}
                          {match.quantity ? ` · ${match.quantity} ${match.unit}` : ""}
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {formatDateSafe(match.createdAt)}
                        </p>
                        {match.notes && (
                          <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            <p className="text-xs text-amber-700">📝 {match.notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-center shrink-0">
                        <div className={`text-xl font-bold ${scoreColor(match.score)}`}>{Math.round((match.score || 0) * 100)}</div>
                        <p className="text-[10px] text-neutral-400">Score</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-neutral-100 flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openDetail(match)}>
                        View Details
                      </Button>
                      {(match.status === "proposed" || match.status === "accepted") && (
                        <Button variant="primary" size="sm" onClick={() => openResolve(match)}>
                          Resolve
                        </Button>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          );
        }}
      </Tabs>

      {/* Detail Modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Match Details"
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
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : matchDetail ? (
          <div className="space-y-5">
            {/* Match overview */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-800">Match #{matchDetail.id?.slice(0, 8)}</p>
                  <p className="text-xs text-blue-600 mt-0.5">{formatStatus(matchDetail.status)}</p>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${scoreColor(matchDetail.score)}`}>
                    {Math.round((matchDetail.score || 0) * 100)}%
                  </div>
                  <p className="text-[10px] text-neutral-500">Match Score</p>
                </div>
              </div>
            </div>

            {/* Score breakdown */}
            {matchDetail.score_breakdown && (
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Score Breakdown</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(matchDetail.score_breakdown)
                    .filter(([k]) => k !== "total")
                    .map(([key, value]) => (
                      <div key={key} className="bg-neutral-50 rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-neutral-600 capitalize">{key.replace(/_/g, " ")}</span>
                        <span className="text-xs font-semibold text-neutral-800">
                          {typeof value === "number" && value <= 1 ? `${Math.round(value * 100)}%` : value}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Parties */}
            <div className="grid grid-cols-2 gap-4">
              {/* Farmer */}
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
              {/* Buyer */}
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

            {/* Crop info */}
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Crop</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-800">{matchDetail.crop_name}</span>
                {matchDetail.crop_name_si && (
                  <span className="text-xs text-neutral-400">({matchDetail.crop_name_si})</span>
                )}
                {matchDetail.crop_category && (
                  <Badge color="green" size="sm">{matchDetail.crop_category}</Badge>
                )}
              </div>
            </div>

            {/* Harvest vs Demand comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Harvest (Supply)</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Quantity</span>
                    <span className="font-medium">{matchDetail.harvest_quantity_kg ? `${matchDetail.harvest_quantity_kg} kg` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Price</span>
                    <span className="font-medium text-green-700">{matchDetail.harvest_price_per_kg ? `Rs. ${matchDetail.harvest_price_per_kg}/kg` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Quality</span>
                    <span className="font-medium">{matchDetail.harvest_quality_grade || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Harvest Date</span>
                    <span className="font-medium">{matchDetail.harvest_date ? formatDateSafe(matchDetail.harvest_date) : "—"}</span>
                  </div>
                  {matchDetail.harvest_is_organic && (
                    <Badge color="green" size="sm">Organic</Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Demand (Request)</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Quantity</span>
                    <span className="font-medium">{matchDetail.demand_quantity_kg ? `${matchDetail.demand_quantity_kg} kg` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Max Price</span>
                    <span className="font-medium text-amber-700">{matchDetail.demand_max_price_per_kg ? `Rs. ${matchDetail.demand_max_price_per_kg}/kg` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Quality</span>
                    <span className="font-medium">{matchDetail.demand_quality_grade || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Needed By</span>
                    <span className="font-medium">{matchDetail.demand_needed_by ? formatDateSafe(matchDetail.demand_needed_by) : "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Agreed terms */}
            {(matchDetail.agreed_price_per_kg || matchDetail.agreed_quantity_kg) && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">Agreed Terms</p>
                <div className="flex gap-6 text-sm">
                  {matchDetail.agreed_price_per_kg && (
                    <div>
                      <span className="text-neutral-500">Price: </span>
                      <span className="font-semibold text-green-800">Rs. {matchDetail.agreed_price_per_kg}/kg</span>
                    </div>
                  )}
                  {matchDetail.agreed_quantity_kg && (
                    <div>
                      <span className="text-neutral-500">Quantity: </span>
                      <span className="font-semibold text-green-800">{matchDetail.agreed_quantity_kg} kg</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {matchDetail.notes && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">Admin Notes</p>
                <p className="text-sm text-neutral-700">{matchDetail.notes}</p>
              </div>
            )}

            {/* Timestamps */}
            <div className="text-xs text-neutral-400 space-y-0.5 pt-2 border-t border-neutral-100">
              <p>Created: {matchDetail.created_at ? formatDateSafe(matchDetail.created_at) : "—"}</p>
              {matchDetail.confirmed_at && <p>Confirmed: {formatDateSafe(matchDetail.confirmed_at)}</p>}
              {matchDetail.fulfilled_at && <p>Fulfilled: {formatDateSafe(matchDetail.fulfilled_at)}</p>}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Resolution Modal */}
      <Modal
        isOpen={resolveOpen}
        onClose={() => setResolveOpen(false)}
        title="Resolve Match"
        size="lg"
        footer={
          <Button variant="primary" fullWidth loading={resolving} onClick={handleResolve}>
            Resolve
          </Button>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-sm font-medium text-blue-800">Match #{selected.id?.slice(0, 8)}</p>
              <p className="text-xs text-blue-600 mt-1">Score: {Math.round((selected.score || 0) * 100)}% · {formatStatus(selected.status)}</p>
            </div>
            <Select
              label="Resolution Action"
              value={resolveAction}
              onChange={e => setResolveAction(e.target.value as typeof resolveAction)}
              options={[
                { value: "completed", label: "Mark Completed" },
                { value: "dismissed", label: "Dismiss Match" },
              ]}
            />
            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1.5">Resolution Note *</label>
              <textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 resize-none"
                placeholder="Explain the resolution decision..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
