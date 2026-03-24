"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

// ── Types ────────────────────────────────────────────────────────────────────
interface AnalyticsData {
  total_users: number;
  total_listings: number;
  active_matches: number;
  revenue: number;
  users_by_role: { role: string; count: number }[];
  listings_by_status: { status: string; count: number }[];
  matches_by_month: { month: string; count: number }[];
}

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_DATA: AnalyticsData = {
  total_users: 1247,
  total_listings: 856,
  active_matches: 124,
  revenue: 2450000,
  users_by_role: [
    { role: "Farmers", count: 842 },
    { role: "Buyers", count: 285 },
    { role: "Suppliers", count: 120 },
  ],
  listings_by_status: [
    { status: "Ready", count: 234 },
    { status: "Matched", count: 124 },
    { status: "Planned", count: 189 },
    { status: "Fulfilled", count: 198 },
    { status: "Expired", count: 67 },
    { status: "Cancelled", count: 44 },
  ],
  matches_by_month: [
    { month: "Oct 2025", count: 45 },
    { month: "Nov 2025", count: 62 },
    { month: "Dec 2025", count: 58 },
    { month: "Jan 2026", count: 78 },
    { month: "Feb 2026", count: 95 },
    { month: "Mar 2026", count: 112 },
  ],
};

// ── Bar colors ───────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  Farmers: "bg-green-500",
  Buyers: "bg-blue-500",
  Suppliers: "bg-amber-500",
};

const STATUS_COLORS: Record<string, string> = {
  Ready: "bg-green-500",
  Matched: "bg-amber-500",
  Planned: "bg-blue-500",
  Fulfilled: "bg-emerald-600",
  Expired: "bg-neutral-400",
  Cancelled: "bg-red-400",
};

// ── Component ────────────────────────────────────────────────────────────────
export default function AdminAnalyticsPage() {
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get<AnalyticsData>("/admin/analytics");
        setData(res);
      } catch {
        setData(MOCK_DATA);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading || !data) {
    return (
      <div className="px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" rounded="lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" rounded="lg" />
      </div>
    );
  }

  const maxByRole = Math.max(...data.users_by_role.map((r) => r.count));
  const maxByStatus = Math.max(...data.listings_by_status.map((s) => s.count));
  const maxByMonth = Math.max(...data.matches_by_month.map((m) => m.count));

  const statCards = [
    {
      label: "Total Users",
      value: data.total_users.toLocaleString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Total Listings",
      value: data.total_listings.toLocaleString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      ),
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Active Matches",
      value: data.active_matches.toLocaleString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Revenue",
      value: `Rs. ${(data.revenue / 1000).toFixed(0)}K`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      ),
      color: "text-emerald-600 bg-emerald-50",
    },
  ];

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>
        <p className="text-sm text-neutral-500 mt-1">Platform overview and key metrics</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Card key={card.label} padding="md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-neutral-500">{card.label}</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">{card.value}</p>
              </div>
              <div className={`p-2 rounded-xl ${card.color}`}>{card.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by Role */}
        <Card padding="lg">
          <h3 className="text-base font-semibold text-neutral-800 mb-4">Users by Role</h3>
          <div className="space-y-3">
            {data.users_by_role.map((item) => (
              <div key={item.role}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-neutral-700 font-medium">{item.role}</span>
                  <span className="text-neutral-500">{item.count.toLocaleString()}</span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${ROLE_COLORS[item.role] || "bg-neutral-400"}`}
                    style={{ width: `${(item.count / maxByRole) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Listings by Status */}
        <Card padding="lg">
          <h3 className="text-base font-semibold text-neutral-800 mb-4">Listings by Status</h3>
          <div className="space-y-3">
            {data.listings_by_status.map((item) => (
              <div key={item.status}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-neutral-700 font-medium">{item.status}</span>
                  <span className="text-neutral-500">{item.count.toLocaleString()}</span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${STATUS_COLORS[item.status] || "bg-neutral-400"}`}
                    style={{ width: `${(item.count / maxByStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Matches by Month */}
        <Card padding="lg" className="lg:col-span-2">
          <h3 className="text-base font-semibold text-neutral-800 mb-4">Matches by Month</h3>
          <div className="flex items-end gap-3 h-48">
            {data.matches_by_month.map((item) => (
              <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-neutral-700">
                  {item.count}
                </span>
                <div className="w-full bg-neutral-100 rounded-t-lg relative" style={{ height: "100%" }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-green-500 rounded-t-lg transition-all duration-500"
                    style={{ height: `${(item.count / maxByMonth) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-neutral-500 whitespace-nowrap">
                  {item.month.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
