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
import { formatStatus } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

type MatchStatus = "proposed"|"farmer_accepted"|"buyer_accepted"|"in_transit"|"disputed"|"cancelled";

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
}


const STATUS_COLOR: Record<MatchStatus, "gold"|"green"|"gray"|"red"|"blue"|"orange"> = {
  proposed:"blue", farmer_accepted:"gold", buyer_accepted:"gold", in_transit:"orange", disputed:"red", cancelled:"gray",
};
const ACTIONS: Record<MatchStatus, { label:string; variant:"primary"|"danger"|"secondary" }[]> = {
  proposed: [{label:"Accept",variant:"primary"},{label:"Decline",variant:"danger"}],
  farmer_accepted: [{label:"Confirm",variant:"primary"}],
  buyer_accepted: [{label:"Complete",variant:"secondary"}],
  in_transit: [],
  disputed: [{label:"Respond",variant:"primary"}],
  cancelled: [],
};

export default function BuyerMatchesPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { isReady } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string|null>(null);

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

  const scoreColor = (s: number) => s>=85?"text-green-600":s>=70?"text-amber-500":"text-red-500";

  const allStatuses: MatchStatus[] = ["proposed","farmer_accepted","buyer_accepted","in_transit","disputed","cancelled"];
  const tabs = [
    { key:"all", label:"All", badge: matches.length },
    ...allStatuses.map(s => ({
      key: s, label: formatStatus(s),
      badge: matches.filter(m=>m.status===s).length,
    })),
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-amber-600 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("buyer.viewMatches")}</h1>
        <p className="text-amber-100 text-sm mt-1">{matches.length} total matches</p>
      </div>

      <Tabs tabs={tabs} defaultTab="all">
        {(activeTab) => {
          const filtered = activeTab==="all" ? matches : matches.filter(m => m.status===activeTab);
          return (
            <div className="px-4 py-4 space-y-3">
              {loading ? (
                Array.from({length:3}).map((_,i) => (
                  <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                    <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-8 w-full mt-2" />
                  </div>
                ))
              ) : filtered.length===0 ? (
                <EmptyState icon="🤝" title="No matches here" description="Matches appear when farmers match your demands." />
              ) : (
                filtered.map(match => (
                  <Card key={match.id} padding="md">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-neutral-900 text-sm">Match #{match.id?.slice(0, 8)}</h3>
                          <Badge color={STATUS_COLOR[match.status]} size="sm" dot>{formatStatus(match.status)}</Badge>
                        </div>
                        <p className="text-sm text-neutral-600 mt-1">
                          Score: {Math.round(match.score * 100)}% · {match.agreed_price_per_kg ? `Rs. ${match.agreed_price_per_kg}/kg` : 'Price TBD'}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">{match.agreed_quantity_kg ? `${match.agreed_quantity_kg} kg · ` : ''}{new Date(match.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-center shrink-0 bg-neutral-50 rounded-xl px-3 py-2">
                        <div className={`text-2xl font-bold ${scoreColor(Math.round(match.score * 100))}`}>{Math.round(match.score * 100)}</div>
                        <p className="text-[10px] text-neutral-400">Match %</p>
                      </div>
                    </div>
                    {ACTIONS[match.status].length > 0 && (
                      <div className="flex gap-2 pt-3 border-t border-neutral-100">
                        {ACTIONS[match.status].map(({label,variant}) => (
                          <Button key={label} variant={variant} size="sm"
                            loading={actionLoading===`${match.id}-${label}`}
                            onClick={() => handleAction(match.id, label)}>
                            {label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          );
        }}
      </Tabs>
    </div>
  );
}
