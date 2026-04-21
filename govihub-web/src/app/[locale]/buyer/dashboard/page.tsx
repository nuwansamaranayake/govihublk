"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { formatDateSafe } from "@/lib/utils";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth";
import { FEATURES } from "@/config/feature-flags";
import AdCarousel from "@/components/ads/AdCarousel";

interface PipelineStage {
  label: string;
  count: number;
  color: string;
}

interface RecentMatch {
  id: string;
  score: number;
  status: string;
  agreed_price_per_kg: number | null;
  agreed_quantity_kg: number | null;
  created_at: string;
}

interface DashboardData {
  buyerName: string;
  activeDemands: number;
  matchedFarmers: number;
  pendingConfirmations: number;
  totalValue: number;
  pipeline: PipelineStage[];
  recentMatches: RecentMatch[];
}


export default function BuyerDashboardPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { isReady } = useAuth();
  const [data, setData] = useState<DashboardData|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hour = new Date().getHours();
  const greeting = hour<12 ? t("greeting.morning") : hour<17 ? t("greeting.afternoon") : t("greeting.evening");

  useEffect(() => {
    if (!isReady) return;
    Promise.all([
      api.get<any>("/users/me").catch(() => null),
      api.get<any>("/listings/demand").catch(() => null),
      api.get<any>("/matches").catch(() => null),
      Promise.resolve(null), // prices API disabled until HARTI feed connected (see feature-flags.ts)
    ])
      .then(([userRes, demandsRes, matchesRes, _pricesRes]) => {
        const demands = Array.isArray(demandsRes) ? demandsRes : demandsRes?.data ?? [];
        const matches = Array.isArray(matchesRes) ? matchesRes : matchesRes?.data ?? [];

        const proposed = matches.filter((m: any) => m.status === "proposed").length;
        const farmerAccepted = matches.filter((m: any) => m.status === "farmer_accepted").length;
        const buyerAccepted = matches.filter((m: any) => m.status === "buyer_accepted").length;
        const inTransit = matches.filter((m: any) => m.status === "in_transit").length;
        const pendingConfirmations = proposed + farmerAccepted;

        setData({
          buyerName: userRes?.name || "Buyer",
          activeDemands: demands.length,
          matchedFarmers: matches.length,
          pendingConfirmations,
          totalValue: matches.reduce((sum: number, m: any) => sum + ((m.agreed_price_per_kg || 0) * (m.agreed_quantity_kg || 0)), 0),
          pipeline: [
            { label: "Proposed", count: proposed, color: "bg-blue-400" },
            { label: "Farmer Accepted", count: farmerAccepted, color: "bg-amber-400" },
            { label: "Buyer Accepted", count: buyerAccepted, color: "bg-amber-500" },
            { label: "In Transit", count: inTransit, color: "bg-orange-400" },
          ],
          recentMatches: matches.slice(0, 5).map((m: any) => ({
            id: m.id || String(Math.random()),
            score: m.score || 0,
            status: m.status || "proposed",
            agreed_price_per_kg: m.agreed_price_per_kg,
            agreed_quantity_kg: m.agreed_quantity_kg,
            created_at: m.created_at || "",
          })),
        });
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load dashboard");
      })
      .finally(() => setLoading(false));
  }, [isReady]);

  const scoreColor = (score: number) =>
    score>=85 ? "text-green-600" : score>=70 ? "text-amber-500" : "text-red-500";

  const STATUS_COLOR: Record<string, "green"|"gold"|"gray"|"blue"|"orange"> = { proposed:"blue", farmer_accepted:"gold", buyer_accepted:"gold", in_transit:"orange", disputed:"gray", cancelled:"gray" };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-gradient-to-br from-amber-600 to-amber-500 px-4 pt-12 pb-16 text-white">
        <p className="text-amber-100 text-sm font-medium">{greeting}</p>
        {loading ? <Skeleton className="h-7 w-44 mt-1" /> : (
          <h1 className="text-2xl font-bold mt-1">{data?.buyerName ?? "Buyer"} 👋</h1>
        )}
        <p className="text-amber-100 text-sm mt-1">{t("buyer.dashboard")}</p>
      </div>

      <div className="px-4 -mt-10 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: t("buyer.activeDemands"), value:data?.activeDemands, color:"text-amber-600" },
            { label: t("common.matchedFarmers"), value:data?.matchedFarmers, color:"text-green-600" },
            { label: t("common.pendingConfirmations"), value:data?.pendingConfirmations, color:"text-blue-600" },
            { label: t("common.totalValue") + " (Rs.)", value:data?.totalValue?.toLocaleString(), color:"text-purple-600" },
          ].map(s => (
            <Card key={s.label} padding="sm" className="text-center">
              {loading ? <Skeleton className="h-8 w-12 mx-auto mb-1" /> : (
                <p className={`text-xl font-bold ${s.color}`}>{s.value ?? 0}</p>
              )}
              <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Advertisement Carousel */}
        {FEATURES.SHOW_ADS && <AdCarousel />}

        {/* Procurement Pipeline */}
        <Card header={<h2 className="font-semibold text-neutral-800 text-sm">{t("common.procurementPipeline")}</h2>} padding="md">
          {loading ? <Skeleton className="h-12 w-full" /> : (
            <div>
              <div className="flex h-4 rounded-full overflow-hidden mb-3">
                {data?.pipeline.map((stage, i) => {
                  const total = data.pipeline.reduce((s,p) => s+p.count, 0);
                  const pct = total > 0 ? (stage.count/total)*100 : 0;
                  return <div key={i} className={`${stage.color} transition-all`} style={{width:`${pct}%`}} />;
                })}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {data?.pipeline.map((stage, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm ${stage.color}`} />
                    <span className="text-xs text-neutral-600">{stage.label}: <strong>{stage.count}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon:"📋", label:t("buyer.addDemand"), href:"demands" },
            { icon:"🤝", label:t("buyer.viewMatches"), href:"matches" },
          ].map(action => (
            <a key={action.label} href={action.href}
              className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 text-center hover:border-amber-400 hover:shadow-md transition-all">
              <p className="text-2xl mb-2" aria-hidden="true">{action.icon}</p>
              <p className="text-xs font-medium text-neutral-700">{action.label}</p>
            </a>
          ))}
        </div>

        {/* Recent Matches */}
        <Card header={<h2 className="font-semibold text-neutral-800 text-sm">{t("common.recentMatches")}</h2>} padding="none">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
          ) : data?.recentMatches.length ? (
            <ul className="divide-y divide-neutral-50">
              {data.recentMatches.map(match => (
                <li key={match.id} className="flex items-center justify-between px-4 py-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-neutral-900 text-sm">Match #{match.id?.slice(0, 8)}</span>
                      <Badge color={STATUS_COLOR[match.status]||"gray"} size="sm" dot>{match.status}</Badge>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">{match.agreed_price_per_kg ? `Rs. ${match.agreed_price_per_kg}/kg` : 'Price TBD'} · {match.agreed_quantity_kg ? `${match.agreed_quantity_kg} kg` : ''} · {formatDateSafe(match.created_at)}</p>
                  </div>
                  <div className={`text-lg font-bold shrink-0 ${scoreColor(Math.round(match.score * 100))}`}>{Math.round(match.score * 100)}%</div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="🤝" title={t("common.noMatchesYet")} description={t("common.postDemandsToMatch")} />
          )}
        </Card>
      </div>
    </div>
  );
}
