"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";

type MatchStatus = "proposed" | "active" | "completed" | "disputed";

interface Match {
  id: string;
  buyerName: string;
  crop: string;
  quantity: number;
  unit: string;
  price: number;
  location: string;
  score: number;
  status: MatchStatus;
  createdAt: string;
}

const MOCK: Match[] = [
  { id:"1", buyerName:"Colombo Fresh Mart", crop:"Tomato", quantity:300, unit:"kg", price:115, location:"Colombo", score:92, status:"proposed", createdAt:"2026-03-20" },
  { id:"2", buyerName:"Lanka Supermart", crop:"Cabbage", quantity:200, unit:"kg", price:80, location:"Gampaha", score:78, status:"active", createdAt:"2026-03-18" },
  { id:"3", buyerName:"Green Foods Ltd", crop:"Carrot", quantity:150, unit:"kg", price:150, location:"Kandy", score:85, status:"completed", createdAt:"2026-03-10" },
  { id:"4", buyerName:"City Vegetables", crop:"Beans", quantity:100, unit:"kg", price:195, location:"Matale", score:70, status:"disputed", createdAt:"2026-03-05" },
];

const STATUS_COLOR: Record<MatchStatus, "gold"|"green"|"gray"|"red"> = {
  proposed:"gold", active:"green", completed:"gray", disputed:"red",
};
const ACTIONS: Record<MatchStatus, { label:string; variant:"primary"|"danger"|"secondary" }[]> = {
  proposed: [{label:"Accept",variant:"primary"},{label:"Reject",variant:"danger"}],
  active: [{label:"Confirm",variant:"primary"},{label:"Fulfill",variant:"secondary"}],
  completed: [],
  disputed: [{label:"Respond",variant:"primary"}],
};

export default function FarmerMatchesPage() {
  const t = useTranslations();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string|null>(null);

  useEffect(() => {
    api.get<Match[]>("/api/v1/farmer/matches")
      .then(setMatches)
      .catch(() => setMatches(MOCK))
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (matchId: string, action: string) => {
    setActionLoading(`${matchId}-${action}`);
    try {
      await api.post(`/api/v1/farmer/matches/${matchId}/${action.toLowerCase()}`);
      const updated = await api.get<Match[]>("/api/v1/farmer/matches");
      setMatches(updated);
    } catch {
      const map: Record<string, MatchStatus> = { Accept:"active", Reject:"completed", Confirm:"active", Fulfill:"completed" };
      if (map[action]) setMatches(prev => prev.map(m => m.id===matchId ? {...m, status:map[action]} : m));
    } finally { setActionLoading(null); }
  };

  const scoreColor = (score: number) =>
    score >= 85 ? "text-green-600" : score >= 70 ? "text-amber-500" : "text-red-500";

  const allStatuses: MatchStatus[] = ["proposed","active","completed","disputed"];
  const tabs = [
    { key:"all", label:"All", badge: matches.length },
    ...allStatuses.map(s => ({
      key: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
      badge: matches.filter(m => m.status===s).length,
    })),
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-green-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("farmer.viewMatches")}</h1>
        <p className="text-green-200 text-sm mt-1">{matches.length} total matches</p>
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
              ) : filtered.length === 0 ? (
                <EmptyState icon="🤝" title="No matches here" description="Matches appear as buyers discover your listings." />
              ) : (
                filtered.map(match => (
                  <Card key={match.id} padding="md">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-neutral-900 text-sm">{match.buyerName}</h3>
                          <Badge color={STATUS_COLOR[match.status]} size="sm" dot>{match.status}</Badge>
                        </div>
                        <p className="text-sm text-neutral-600 mt-1">
                          {match.crop} · {match.quantity} {match.unit} · Rs. {match.price}/{match.unit}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">📍 {match.location} · {match.createdAt}</p>
                      </div>
                      <div className="text-center shrink-0 bg-neutral-50 rounded-xl px-3 py-2">
                        <div className={`text-2xl font-bold ${scoreColor(match.score)}`}>{match.score}</div>
                        <p className="text-[10px] text-neutral-400">Match %</p>
                      </div>
                    </div>
                    {ACTIONS[match.status].length > 0 && (
                      <div className="flex gap-2 pt-3 border-t border-neutral-100">
                        {ACTIONS[match.status].map(({label, variant}) => (
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
