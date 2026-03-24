"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface DashboardData {
  farmerName: string;
  activeListings: number;
  activeMatches: number;
  pendingOffers: number;
  weather: { temp: number; condition: string; humidity: number; location: string };
  marketPrices: { crop: string; price: number; unit: string; change: number }[];
  recentActivity: { id: string; type: string; message: string; time: string }[];
}

const MOCK: DashboardData = {
  farmerName: "Kamal Perera",
  activeListings: 3,
  activeMatches: 5,
  pendingOffers: 2,
  weather: { temp: 29, condition: "Partly Cloudy", humidity: 72, location: "Kandy" },
  marketPrices: [
    { crop: "Tomato", price: 120, unit: "kg", change: 8 },
    { crop: "Cabbage", price: 85, unit: "kg", change: -3 },
    { crop: "Carrot", price: 155, unit: "kg", change: 12 },
    { crop: "Beans", price: 200, unit: "kg", change: 0 },
  ],
  recentActivity: [
    { id: "1", type: "match", message: "New match for your Tomato listing", time: "2h ago" },
    { id: "2", type: "offer", message: "Buyer accepted your price for Cabbage", time: "5h ago" },
    { id: "3", type: "diagnosis", message: "Crop diagnosis completed", time: "1d ago" },
  ],
};

export default function FarmerDashboardPage() {
  const t = useTranslations();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  useEffect(() => {
    api.get<DashboardData>("/api/v1/farmer/dashboard")
      .then(setData)
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, []);

  const activityIcon = (type: string) =>
    type === "match" ? "🤝" : type === "offer" ? "💰" : "🔬";

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-green-700 to-green-500 px-4 pt-12 pb-16 text-white">
        <p className="text-green-200 text-sm font-medium">{greeting}</p>
        {loading ? (
          <Skeleton className="h-7 w-44 mt-1" />
        ) : (
          <h1 className="text-2xl font-bold mt-1">{data?.farmerName ?? "Farmer"} 👋</h1>
        )}
        <p className="text-green-100 text-sm mt-1">{t("farmer.dashboard")}</p>
      </div>

      <div className="px-4 -mt-10 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Listings", value: data?.activeListings, colorClass: "text-green-600" },
            { label: "Matches", value: data?.activeMatches, colorClass: "text-amber-500" },
            { label: "Offers", value: data?.pendingOffers, colorClass: "text-blue-600" },
          ].map((s) => (
            <Card key={s.label} padding="sm" className="text-center">
              {loading ? (
                <Skeleton className="h-8 w-10 mx-auto mb-1" />
              ) : (
                <p className={`text-2xl font-bold ${s.colorClass}`}>{s.value ?? 0}</p>
              )}
              <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Weather */}
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wide font-medium">Weather</p>
              {loading ? (
                <Skeleton className="h-9 w-24 mt-1" />
              ) : (
                <p className="text-3xl font-bold text-neutral-800 mt-1">{data?.weather.temp}°C</p>
              )}
              {loading ? (
                <Skeleton className="h-4 w-36 mt-1" />
              ) : (
                <p className="text-sm text-neutral-500 mt-1">
                  {data?.weather.condition} · {data?.weather.location}
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="text-5xl" aria-hidden="true">⛅</span>
              {!loading && (
                <p className="text-xs text-neutral-400 mt-1">Humidity {data?.weather.humidity}%</p>
              )}
            </div>
          </div>
        </Card>

        {/* Market Prices */}
        <Card
          header={<h2 className="font-semibold text-neutral-800 text-sm">Market Prices Today</h2>}
          padding="none"
        >
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : data?.marketPrices.length ? (
            <ul className="divide-y divide-neutral-50">
              {data.marketPrices.map((item) => (
                <li key={item.crop} className="flex items-center justify-between px-4 py-3">
                  <span className="font-medium text-neutral-800 text-sm">{item.crop}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-600">Rs. {item.price}/{item.unit}</span>
                    <Badge
                      color={item.change > 0 ? "green" : item.change < 0 ? "red" : "gray"}
                      size="sm"
                    >
                      {item.change > 0 ? "+" : ""}{item.change}%
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="📊" title="No market data available" />
          )}
        </Card>

        {/* Quick Actions */}
        <div>
          <h2 className="font-semibold text-neutral-800 mb-3 text-sm">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: "🌾", label: t("farmer.addListing"), href: "listings" },
              { icon: "🔬", label: t("farmer.diagnoseCrop"), href: "diagnosis" },
              { icon: "💬", label: t("farmer.askAdvisor"), href: "advisory" },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 text-center hover:border-green-400 hover:shadow-md transition-all"
              >
                <p className="text-2xl mb-2" aria-hidden="true">{action.icon}</p>
                <p className="text-xs font-medium text-neutral-700 leading-tight">{action.label}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <Card
          header={<h2 className="font-semibold text-neutral-800 text-sm">Recent Activity</h2>}
          padding="none"
        >
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : data?.recentActivity.length ? (
            <ul className="divide-y divide-neutral-50">
              {data.recentActivity.map((item) => (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm flex-shrink-0">
                    {activityIcon(item.type)}
                  </div>
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
