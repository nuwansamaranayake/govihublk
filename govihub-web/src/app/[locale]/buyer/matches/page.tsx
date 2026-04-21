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
import { Tabs } from "@/components/ui/Tabs";
import { formatStatus, formatDateSafe } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ListingDetailsModal } from "@/components/ui/ListingDetailsModal";

type MatchStatus = "proposed" | "accepted" | "completed" | "dismissed";

interface MatchParty {
  name: string;
  phone: string | null;
  district: string | null;
}

interface ListingDetail {
  id: string;
  quantity_kg: number | null;
  price_per_kg?: number | null;
  min_price_per_kg?: number | null;
  max_price_per_kg?: number | null;
  variety: string | null;
  grade: string | null;
  harvest_date?: string | null;
  available_from?: string | null;
  available_until?: string | null;
  needed_by?: string | null;
  description: string | null;
  images?: string[] | null;
  status: string | null;
  is_organic?: boolean | null;
  delivery_available?: boolean | null;
  is_recurring?: boolean | null;
  created_at?: string | null;
}

interface Match {
  id: string;
  harvest_id: string;
  demand_id: string;
  score: number;
  status: MatchStatus;
  agreed_price_per_kg: number | null;
  agreed_quantity_kg: number | null;
  created_at: string;
  updated_at: string;
  farmer?: MatchParty | null;
  buyer?: MatchParty | null;
  crop_name?: string | null;
  harvest_quantity_kg?: number | null;
  demand_quantity_kg?: number | null;
  harvest?: ListingDetail | null;
  demand?: ListingDetail | null;
}

const STATUS_COLOR: Record<MatchStatus, "blue" | "green" | "gold" | "gray"> = {
  proposed: "blue",
  accepted: "gold",
  completed: "green",
  dismissed: "gray",
};

const ACTION_KEYS: Record<MatchStatus, { key: string; apiAction: string; variant: "primary" | "danger" | "secondary" }[]> = {
  proposed: [
    { key: "accept", apiAction: "accept", variant: "primary" },
    { key: "dismiss", apiAction: "dismiss", variant: "danger" },
  ],
  accepted: [
    { key: "complete", apiAction: "complete", variant: "primary" },
    { key: "dismiss", apiAction: "dismiss", variant: "danger" },
  ],
  completed: [],
  dismissed: [],
};

export default function BuyerMatchesPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { isReady } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{ open: boolean; type: "harvest" | "demand"; match: Match | null }>({ open: false, type: "harvest", match: null });

  const loadMatches = () => {
    setError(null);
    api.get<any>("/matches")
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        setMatches(items);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load matches");
        setMatches([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isReady) loadMatches(); }, [isReady]);

  const handleAction = async (matchId: string, action: string) => {
    setActionLoading(`${matchId}-${action}`);
    try {
      await api.post(`/matches/${matchId}/${action.toLowerCase()}`);
      loadMatches();
    } catch (err: any) {
      setError(err?.message || "Action failed");
    } finally { setActionLoading(null); }
  };

  const scoreColor = (s: number) => s >= 85 ? "text-green-600" : s >= 70 ? "text-amber-500" : "text-red-500";

  const allStatuses: MatchStatus[] = ["proposed", "accepted", "completed", "dismissed"];
  const tabs = [
    { key: "all", label: t("matches.all"), badge: matches.length },
    ...allStatuses.map(s => ({
      key: s, label: t(`matches.status_${s}`),
      badge: matches.filter(m => m.status === s).length,
    })),
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-amber-600 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("buyer.viewMatches")}</h1>
        <p className="text-amber-100 text-sm mt-1">{matches.length} {t("matches.totalMatches")}</p>
      </div>

      <Tabs tabs={tabs} defaultTab="all">
        {(activeTab) => {
          const filtered = activeTab === "all" ? matches : matches.filter(m => m.status === activeTab);
          return (
            <div className="px-4 py-4 space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                    <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-8 w-full mt-2" />
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <EmptyState icon="🤝" title={t("matches.noMatchesHere")} description={t("matches.matchesAppearBuyer")} />
              ) : (
                filtered.map(match => (
                  <Card key={match.id} padding="md">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-neutral-900 text-sm">Match #{match.id?.slice(0, 8)}</h3>
                          <Badge color={STATUS_COLOR[match.status] || "gray"} size="sm" dot>{formatStatus(match.status)}</Badge>
                        </div>
                        <p className="text-sm text-neutral-600 mt-1">
                          {match.crop_name && <span className="font-medium">{match.crop_name} · </span>}
                          {t("matches.score")}: {Math.round(match.score * 100)}% · {match.agreed_price_per_kg ? `Rs. ${match.agreed_price_per_kg}/kg` : t("matches.priceTBD")}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                          {match.harvest_quantity_kg ? `${match.harvest_quantity_kg} kg · ` : ''}
                          {match.agreed_quantity_kg ? `${match.agreed_quantity_kg} kg · ` : ''}{formatDateSafe(match.created_at)}
                        </p>
                      </div>
                      <div className="text-center shrink-0 bg-neutral-50 rounded-xl px-3 py-2">
                        <div className={`text-2xl font-bold ${scoreColor(Math.round(match.score * 100))}`}>{Math.round(match.score * 100)}</div>
                        <p className="text-[10px] text-neutral-400">{t("matches.matchPercent")}</p>
                      </div>
                    </div>
                    {/* Harvest listing details — what the farmer is offering */}
                    {match.harvest && (
                      <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                        <p className="text-xs font-semibold text-emerald-800 mb-2">🌾 {t("matches.harvestDetails")}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div className="text-neutral-500">{t("matches.quantityAvailable")}</div>
                          <div className="font-medium text-neutral-800">{match.harvest.quantity_kg ? `${match.harvest.quantity_kg} kg` : "—"}</div>
                          <div className="text-neutral-500">{t("matches.askingPrice")}</div>
                          <div className="font-medium text-neutral-800">{match.harvest.price_per_kg ? `Rs. ${match.harvest.price_per_kg}/kg` : "—"}</div>
                          {match.harvest.variety && (<><div className="text-neutral-500">{t("matches.variety")}</div><div className="font-medium text-neutral-800">{match.harvest.variety}</div></>)}
                          {match.harvest.grade && (<><div className="text-neutral-500">{t("matches.grade")}</div><div className="font-medium text-neutral-800">{match.harvest.grade}</div></>)}
                          <div className="text-neutral-500">{t("matches.available")}</div>
                          <div className="font-medium text-neutral-800">
                            {match.harvest.available_from ? formatDateSafe(match.harvest.available_from) : "—"}
                            {match.harvest.available_until ? ` — ${formatDateSafe(match.harvest.available_until)}` : ""}
                          </div>
                        </div>
                        {match.harvest.description && (
                          <p className="text-xs text-neutral-600 mt-2 italic">{match.harvest.description}</p>
                        )}
                        <button
                          onClick={() => setDetailModal({ open: true, type: "harvest", match })}
                          className="mt-2 w-full py-1.5 text-xs font-medium text-emerald-700 border border-emerald-300 bg-white hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          🔍 {t("matches.viewDetails")}
                        </button>
                      </div>
                    )}
                    {(ACTION_KEYS[match.status] || []).length > 0 && (
                      <div className="flex gap-2 pt-3 border-t border-neutral-100">
                        {(ACTION_KEYS[match.status] || []).map(({ key, apiAction, variant }) => (
                          <Button key={key} variant={variant} size="sm"
                            loading={actionLoading === `${match.id}-${apiAction}`}
                            onClick={() => handleAction(match.id, apiAction)}>
                            {t(`matches.${key}`)}
                          </Button>
                        ))}
                      </div>
                    )}
                    {/* Farmer contact info */}
                    {match.farmer?.name ? (
                      <div className="mt-3 bg-green-50 border border-green-100 rounded-xl p-3">
                        <p className="text-xs font-medium text-green-800 mb-1">👤 {match.farmer.name}</p>
                        {match.farmer.phone && (
                          <div className="flex items-center justify-between">
                            <a href={`tel:${match.farmer.phone}`} className="text-sm font-medium text-green-600">
                              📞 {match.farmer.phone}
                            </a>
                            <a href={`tel:${match.farmer.phone}`}
                              className="px-3 py-1 text-xs font-medium rounded-lg bg-green-600 text-white">
                              {t("common.call")}
                            </a>
                          </div>
                        )}
                        {match.farmer.district && (
                          <p className="text-xs text-green-600 mt-1">📍 {match.farmer.district}</p>
                        )}
                      </div>
                    ) : null}
                  </Card>
                ))
              )}
            </div>
          );
        }}
      </Tabs>

      {/* Listing Details Modal */}
      <ListingDetailsModal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, type: "harvest", match: null })}
        type={detailModal.type}
        listing={detailModal.match?.harvest ?? null}
        cropName={detailModal.match?.crop_name}
        partyName={detailModal.match?.farmer?.name}
        partyDistrict={detailModal.match?.farmer?.district}
      />
    </div>
  );
}
