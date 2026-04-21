"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth";

// ── Types ────────────────────────────────────────────────────────────────────

/* Dashboard stats from /admin/dashboard */
interface DashboardStats {
  total_users: number;
  total_farmers: number;
  total_buyers: number;
  total_suppliers: number;
  active_users_last_30d: number;
  total_harvest_listings: number;
  active_harvest_listings: number;
  total_demand_postings: number;
  active_demand_postings: number;
  total_matches: number;
  confirmed_matches: number;
  disputed_matches: number;
  total_diagnoses: number;
  total_knowledge_chunks: number;
  total_advisory_questions: number;
}

/* Match analytics from /admin/analytics/matches */
interface MatchAnalytics {
  total_matches: number;
  matches_by_status: Record<string, number>;
  avg_match_score: number;
  confirmed_rate: number;
  fulfillment_rate: number;
  dispute_rate: number;
  matches_per_day: { date: string; count: number }[];
}

/* User analytics from /admin/analytics/users */
interface UserAnalytics {
  total_new_users: number;
  new_users_by_role: Record<string, number>;
  new_users_by_district: Record<string, number>;
  active_users: number;
  users_per_day: { date: string; count: number }[];
}

// ── Bar colors ───────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  farmer: "bg-green-500",
  buyer: "bg-blue-500",
  supplier: "bg-amber-500",
  admin: "bg-neutral-500",
};

const ROLE_LABELS: Record<string, string> = {
  farmer: "Farmers",
  buyer: "Buyers",
  supplier: "Suppliers",
  admin: "Admins",
};

const STATUS_COLORS: Record<string, string> = {
  proposed: "bg-blue-400",
  farmer_accepted: "bg-amber-400",
  buyer_accepted: "bg-amber-500",
  confirmed: "bg-green-500",
  in_transit: "bg-emerald-500",
  fulfilled: "bg-emerald-600",
  disputed: "bg-red-400",
  cancelled: "bg-neutral-400",
};

// ── Component ────────────────────────────────────────────────────────────────
export default function AdminAnalyticsPage() {
  const t = useTranslations();
  const { isReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [matchAnalytics, setMatchAnalytics] = useState<MatchAnalytics | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);

  useEffect(() => {
    if (!isReady) return;
    Promise.all([
      api.get<DashboardStats>("/admin/dashboard"),
      api.get<MatchAnalytics>("/admin/analytics/matches").catch(() => null),
      api.get<UserAnalytics>("/admin/analytics/users").catch(() => null),
    ])
      .then(([d, m, u]) => {
        setDashboard(d);
        setMatchAnalytics(m);
        setUserAnalytics(u);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isReady]);

  if (loading || !dashboard) {
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

  const totalListings = dashboard.total_harvest_listings + dashboard.total_demand_postings;

  const statCards = [
    {
      label: "Total Users",
      value: dashboard.total_users.toLocaleString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Total Listings",
      value: totalListings.toLocaleString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      ),
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Total Matches",
      value: dashboard.total_matches.toLocaleString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Knowledge Chunks",
      value: dashboard.total_knowledge_chunks.toLocaleString(),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
      color: "text-emerald-600 bg-emerald-50",
    },
  ];

  // Build users by role data from dashboard stats
  const usersByRole = [
    { role: "Farmers", count: dashboard.total_farmers, color: "bg-green-500" },
    { role: "Buyers", count: dashboard.total_buyers, color: "bg-blue-500" },
    { role: "Suppliers", count: dashboard.total_suppliers, color: "bg-amber-500" },
  ].filter((r) => r.count > 0);

  // If we have user analytics with role breakdown, use that instead
  const roleData =
    userAnalytics?.new_users_by_role &&
    Object.keys(userAnalytics.new_users_by_role).length > 0
      ? Object.entries(userAnalytics.new_users_by_role).map(([role, count]) => ({
          role: ROLE_LABELS[role] || role,
          count,
          color: ROLE_COLORS[role] || "bg-neutral-400",
        }))
      : usersByRole;

  const maxByRole = Math.max(...roleData.map((r) => r.count), 1);

  // Matches by status
  const matchStatusData =
    matchAnalytics?.matches_by_status &&
    Object.keys(matchAnalytics.matches_by_status).length > 0
      ? Object.entries(matchAnalytics.matches_by_status).map(([status, count]) => ({
          status: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          count,
          color: STATUS_COLORS[status] || "bg-neutral-400",
        }))
      : [];

  const maxByStatus = Math.max(...matchStatusData.map((s) => s.count), 1);

  // Listings breakdown
  const listingsData = [
    { label: "Harvest Listings", count: dashboard.total_harvest_listings, active: dashboard.active_harvest_listings },
    { label: "Demand Postings", count: dashboard.total_demand_postings, active: dashboard.active_demand_postings },
  ];

  // Additional stats
  const additionalStats = [
    { label: "Active Users (30d)", value: dashboard.active_users_last_30d },
    { label: "Confirmed Matches", value: dashboard.confirmed_matches },
    { label: "Disputed Matches", value: dashboard.disputed_matches },
    { label: "Crop Diagnoses", value: dashboard.total_diagnoses },
    { label: "Advisory Questions", value: dashboard.total_advisory_questions },
  ];

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Platform overview and key metrics — live data
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Card key={card.label} padding="md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-neutral-500">{card.label}</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">
                  {card.value}
                </p>
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
          <h3 className="text-base font-semibold text-neutral-800 mb-4">
            Users by Role
          </h3>
          {roleData.length > 0 ? (
            <div className="space-y-3">
              {roleData.map((item) => (
                <div key={item.role}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-neutral-700 font-medium">
                      {item.role}
                    </span>
                    <span className="text-neutral-500">
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${item.color}`}
                      style={{
                        width: `${(item.count / maxByRole) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400 text-center py-8">
              No farmer/buyer/supplier accounts yet
            </p>
          )}
        </Card>

        {/* Listings breakdown */}
        <Card padding="lg">
          <h3 className="text-base font-semibold text-neutral-800 mb-4">
            Listings Overview
          </h3>
          {totalListings > 0 ? (
            <div className="space-y-4">
              {listingsData.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-neutral-700 font-medium">
                      {item.label}
                    </span>
                    <span className="text-neutral-500">
                      {item.count} total · {item.active} active
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-3">
                    <div
                      className="h-3 rounded-full bg-green-500 transition-all duration-500"
                      style={{
                        width: item.count > 0 ? `${(item.active / item.count) * 100}%` : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400 text-center py-8">
              No listings created yet
            </p>
          )}
        </Card>

        {/* Matches by Status */}
        {matchStatusData.length > 0 && (
          <Card padding="lg">
            <h3 className="text-base font-semibold text-neutral-800 mb-4">
              Matches by Status
            </h3>
            <div className="space-y-3">
              {matchStatusData.map((item) => (
                <div key={item.status}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-neutral-700 font-medium">
                      {item.status}
                    </span>
                    <span className="text-neutral-500">
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${item.color}`}
                      style={{
                        width: `${(item.count / maxByStatus) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Additional Stats */}
        <Card padding="lg" className={matchStatusData.length > 0 ? "" : "lg:col-span-2"}>
          <h3 className="text-base font-semibold text-neutral-800 mb-4">
            Platform Activity
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {additionalStats.map((stat) => (
              <div
                key={stat.label}
                className="bg-neutral-50 rounded-xl p-4 text-center"
              >
                <p className="text-2xl font-bold text-neutral-800">
                  {stat.value.toLocaleString()}
                </p>
                <p className="text-xs text-neutral-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
