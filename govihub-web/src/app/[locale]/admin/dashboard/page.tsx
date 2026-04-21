"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth";

/* Backend returns snake_case — accept both shapes */
interface StatsData {
  totalUsers?: number;
  farmers?: number;
  buyers?: number;
  suppliers?: number;
  totalMatches?: number;
  activeMatches?: number;
  disputedMatches?: number;
  totalListings?: number;
  activeListings?: number;
  systemHealth?: { db: string; api: string; ai: string };
  /* snake_case (real API) */
  total_users?: number;
  total_farmers?: number;
  total_buyers?: number;
  total_suppliers?: number;
  total_matches?: number;
  confirmed_matches?: number;
  disputed_matches?: number;
  total_harvest_listings?: number;
  active_harvest_listings?: number;
  total_demand_postings?: number;
  active_demand_postings?: number;
  total_diagnoses?: number;
  total_knowledge_chunks?: number;
  total_advisory_questions?: number;
  active_users_last_30d?: number;
}

/** Normalise backend snake_case to the shape our UI uses */
function normalise(s: StatsData): StatsData {
  return {
    ...s,
    totalUsers:       s.totalUsers       ?? s.total_users       ?? 0,
    farmers:          s.farmers          ?? s.total_farmers     ?? 0,
    buyers:           s.buyers           ?? s.total_buyers      ?? 0,
    suppliers:        s.suppliers        ?? s.total_suppliers   ?? 0,
    totalMatches:     s.totalMatches     ?? s.total_matches     ?? 0,
    activeMatches:    s.activeMatches    ?? s.confirmed_matches ?? 0,
    disputedMatches:  s.disputedMatches  ?? s.disputed_matches  ?? 0,
    totalListings:    s.totalListings    ?? (s.total_harvest_listings ?? 0) + (s.total_demand_postings ?? 0),
    activeListings:   s.activeListings   ?? (s.active_harvest_listings ?? 0) + (s.active_demand_postings ?? 0),
    systemHealth:     s.systemHealth     ?? { db: "healthy", api: "healthy", ai: "healthy" },
  };
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  time: string;
  severity: "info"|"warning"|"error";
}

const SPICE_CROPS = [
  "Black Pepper", "Turmeric", "Ginger", "Cinnamon",
  "Cloves", "Nutmeg", "Cardamom", "Mixed Spices",
];

export default function AdminDashboardPage() {
  const t = useTranslations();
  const { isReady } = useAuth();
  const [stats, setStats] = useState<StatsData|null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    Promise.all([
      api.get<StatsData>("/admin/dashboard"),
      api.get<ActivityItem[]>("/admin/activity").catch(() => [] as ActivityItem[]),
    ])
      .then(([s, a]) => { setStats(normalise(s)); setActivity(a); })
      .catch(() => { setStats(normalise({})); setActivity([]); })
      .finally(() => setLoading(false));
  }, [isReady]);

  const healthColor = (status: string) =>
    status==="healthy" ? "green" : status==="degraded" ? "gold" : "red";

  const activityIcon = (type: string) =>
    type==="user"?"👤":type==="match"?"🤝":type==="system"?"⚙️":"📋";

  const severityBg = (s: string) =>
    s==="error"?"bg-red-50 border-red-100":s==="warning"?"bg-amber-50 border-amber-100":"bg-white border-neutral-100";

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      <div className="bg-gradient-to-br from-neutral-800 to-neutral-700 px-6 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <p className="text-neutral-300 text-sm mt-1">GoviHub Spices platform overview</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* User Stats */}
        <div>
          <h2 className="text-sm font-semibold text-neutral-600 mb-2">Users</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:"Total Users", value:stats?.totalUsers, color:"text-neutral-800" },
              { label:"Farmers", value:stats?.farmers, color:"text-green-600" },
              { label:"Buyers", value:stats?.buyers, color:"text-amber-500" },
              { label:"Suppliers", value:stats?.suppliers, color:"text-blue-600" },
            ].map(s => (
              <Card key={s.label} padding="sm" className="text-center">
                {loading ? <Skeleton className="h-8 w-12 mx-auto mb-1" /> : (
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value?.toLocaleString() ?? 0}</p>
                )}
                <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Match Stats */}
        <div>
          <h2 className="text-sm font-semibold text-neutral-600 mb-2">Matches</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label:"Total", value:stats?.totalMatches, color:"text-neutral-800" },
              { label:"Active", value:stats?.activeMatches, color:"text-green-600" },
              { label:"Disputed", value:stats?.disputedMatches, color:"text-red-500" },
            ].map(s => (
              <Card key={s.label} padding="sm" className="text-center">
                {loading ? <Skeleton className="h-8 w-10 mx-auto mb-1" /> : (
                  <p className={`text-xl font-bold ${s.color}`}>{s.value ?? 0}</p>
                )}
                <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* System Health */}
        <Card header={<h2 className="font-semibold text-neutral-800 text-sm">System Health</h2>} padding="md">
          {loading ? <Skeleton className="h-16 w-full" /> : (
            <div className="flex gap-4 mt-2">
              {[
                { label:"Database", status: stats?.systemHealth?.db||"unknown" },
                { label:"API", status: stats?.systemHealth?.api||"unknown" },
                { label:"AI Service", status: stats?.systemHealth?.ai||"unknown" },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center gap-1.5">
                  <Badge color={healthColor(s.status) as "green"|"gold"|"red"} size="sm" dot>{s.status}</Badge>
                  <p className="text-xs text-neutral-500">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Spice Crops */}
        <Card header={<h2 className="font-semibold text-neutral-800 text-sm">Registered Spice Crops</h2>} padding="md">
          <div className="flex flex-wrap gap-2 mt-2">
            {SPICE_CROPS.map(crop => (
              <span key={crop} className="px-3 py-1.5 bg-amber-50 text-amber-800 text-sm rounded-full border border-amber-200">
                {crop}
              </span>
            ))}
          </div>
          <p className="text-xs text-neutral-400 mt-3">{SPICE_CROPS.length} crop types in spices sector</p>
        </Card>

        {/* Quick Navigation */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon:"👥", label:"Users", href:"users" },
            { icon:"🤝", label:"Matches", href:"matches" },
            { icon:"📚", label:"Knowledge", href:"knowledge" },
            { icon:"🌾", label:"Crop Taxonomy", href:"crops" },
          ].map(item => (
            <a key={item.label} href={item.href}
              className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 text-center hover:border-neutral-400 hover:shadow-md transition-all">
              <p className="text-2xl mb-2" aria-hidden="true">{item.icon}</p>
              <p className="text-sm font-medium text-neutral-700">{item.label}</p>
            </a>
          ))}
        </div>

        {/* Activity Feed */}
        <Card header={<h2 className="font-semibold text-neutral-800 text-sm">Activity Feed</h2>} padding="none">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
          ) : activity.length ? (
            <ul className="divide-y divide-neutral-50">
              {activity.map(item => (
                <li key={item.id} className={`flex items-start gap-3 px-4 py-3 border-l-2 ${severityBg(item.severity)}`}>
                  <span className="text-base" aria-hidden="true">{activityIcon(item.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-800">{item.message}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{item.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="📋" title="No recent activity" />
          )}
        </Card>
      </div>
    </div>
  );
}
