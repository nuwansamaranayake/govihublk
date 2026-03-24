"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface PipelineStage {
  label: string;
  count: number;
  color: string;
}

interface RecentMatch {
  id: string;
  farmerName: string;
  crop: string;
  quantity: number;
  unit: string;
  location: string;
  score: number;
  status: string;
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

const MOCK: DashboardData = {
  buyerName: "Nimal Silva",
  activeDemands: 4,
  matchedFarmers: 12,
  pendingConfirmations: 3,
  totalValue: 485000,
  pipeline: [
    { label:"Proposed", count:5, color:"bg-blue-400" },
    { label:"Farmer Accepted", count:4, color:"bg-amber-400" },
    { label:"Buyer Accepted", count:2, color:"bg-amber-500" },
    { label:"In Transit", count:8, color:"bg-orange-400" },
  ],
  recentMatches: [
    { id:"1", farmerName:"Kamal Perera", crop:"Tomato", quantity:300, unit:"kg", location:"Kandy", score:92, status:"farmer_accepted" },
    { id:"2", farmerName:"Nimal Silva", crop:"Cabbage", quantity:200, unit:"kg", location:"Nuwara Eliya", score:85, status:"proposed" },
    { id:"3", farmerName:"Saman Fernando", crop:"Carrot", quantity:150, unit:"kg", location:"Badulla", score:78, status:"buyer_accepted" },
  ],
};

export default function BuyerDashboardPage() {
  const t = useTranslations();
  const [data, setData] = useState<DashboardData|null>(null);
  const [loading, setLoading] = useState(true);
  const hour = new Date().getHours();
  const greeting = hour<12 ? "Good Morning" : hour<17 ? "Good Afternoon" : "Good Evening";

  useEffect(() => {
    api.get<DashboardData>("/buyer/dashboard")
      .then(setData)
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, []);

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
            { label:"Active Demands", value:data?.activeDemands, color:"text-amber-600" },
            { label:"Matched Farmers", value:data?.matchedFarmers, color:"text-green-600" },
            { label:"Pending Confirmations", value:data?.pendingConfirmations, color:"text-blue-600" },
            { label:"Total Value (Rs.)", value:data?.totalValue?.toLocaleString(), color:"text-purple-600" },
          ].map(s => (
            <Card key={s.label} padding="sm" className="text-center">
              {loading ? <Skeleton className="h-8 w-12 mx-auto mb-1" /> : (
                <p className={`text-xl font-bold ${s.color}`}>{s.value ?? 0}</p>
              )}
              <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Procurement Pipeline */}
        <Card header={<h2 className="font-semibold text-neutral-800 text-sm">Procurement Pipeline</h2>} padding="md">
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
        <Card header={<h2 className="font-semibold text-neutral-800 text-sm">Recent Matches</h2>} padding="none">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
          ) : data?.recentMatches.length ? (
            <ul className="divide-y divide-neutral-50">
              {data.recentMatches.map(match => (
                <li key={match.id} className="flex items-center justify-between px-4 py-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-neutral-900 text-sm">{match.farmerName}</span>
                      <Badge color={STATUS_COLOR[match.status]||"gray"} size="sm" dot>{match.status}</Badge>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">{match.crop} · {match.quantity} {match.unit} · {match.location}</p>
                  </div>
                  <div className={`text-lg font-bold shrink-0 ${scoreColor(match.score)}`}>{match.score}%</div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="🤝" title="No matches yet" description="Post demands to start receiving farmer matches." />
          )}
        </Card>
      </div>
    </div>
  );
}
