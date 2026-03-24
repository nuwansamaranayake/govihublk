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

type MatchStatus = "proposed"|"active"|"completed"|"disputed";

interface Match {
  id: string;
  farmerName: string;
  crop: string;
  quantity: number;
  unit: string;
  price: number;
  location: string;
  score: number;
  status: MatchStatus;
  createdAt: string;
  clusterSize?: number; // multi-farmer cluster
}

const MOCK: Match[] = [
  { id:"1", farmerName:"Kamal Perera", crop:"Tomato", quantity:300, unit:"kg", price:115, location:"Kandy", score:92, status:"proposed", createdAt:"2026-03-20" },
  { id:"2", farmerName:"Nimal Silva", crop:"Cabbage", quantity:200, unit:"kg", price:80, location:"Nuwara Eliya", score:78, status:"active", createdAt:"2026-03-18" },
  { id:"3", farmerName:"3 Farmers Cluster", crop:"Tomato", quantity:800, unit:"kg", price:110, location:"Kandy Region", score:88, status:"proposed", createdAt:"2026-03-17", clusterSize:3 },
  { id:"4", farmerName:"Saman Fernando", crop:"Carrot", quantity:150, unit:"kg", price:150, location:"Badulla", score:85, status:"completed", createdAt:"2026-03-10" },
];

const STATUS_COLOR: Record<MatchStatus, "gold"|"green"|"gray"|"red"> = {
  proposed:"gold", active:"green", completed:"gray", disputed:"red",
};
const ACTIONS: Record<MatchStatus, { label:string; variant:"primary"|"danger"|"secondary" }[]> = {
  proposed: [{label:"Accept",variant:"primary"},{label:"Decline",variant:"danger"}],
  active: [{label:"Confirm",variant:"primary"},{label:"Complete",variant:"secondary"}],
  completed: [],
  disputed: [{label:"Respond",variant:"primary"}],
};

export default function BuyerMatchesPage() {
  const t = useTranslations();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string|null>(null);

  useEffect(() => {
    api.get<Match[]>("/api/v1/buyer/matches")
      .then(setMatches)
      .catch(() => setMatches(MOCK))
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async (matchId: string, action: string) => {
    setActionLoading(`${matchId}-${action}`);
    try {
      await api.post(`/api/v1/buyer/matches/${matchId}/${action.toLowerCase()}`);
      const updated = await api.get<Match[]>("/api/v1/buyer/matches");
      setMatches(updated);
    } catch {
      const map: Record<string, MatchStatus> = { Accept:"active", Decline:"completed", Confirm:"active", Complete:"completed" };
      if (map[action]) setMatches(prev => prev.map(m => m.id===matchId ? {...m, status:map[action]} : m));
    } finally { setActionLoading(null); }
  };

  const scoreColor = (s: number) => s>=85?"text-green-600":s>=70?"text-amber-500":"text-red-500";

  const allStatuses: MatchStatus[] = ["proposed","active","completed","disputed"];
  const tabs = [
    { key:"all", label:"All", badge: matches.length },
    ...allStatuses.map(s => ({
      key: s, label: s.charAt(0).toUpperCase()+s.slice(1),
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
                          <h3 className="font-semibold text-neutral-900 text-sm">{match.farmerName}</h3>
                          <Badge color={STATUS_COLOR[match.status]} size="sm" dot>{match.status}</Badge>
                          {match.clusterSize && (
                            <Badge color="blue" size="sm">Cluster of {match.clusterSize}</Badge>
                          )}
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
