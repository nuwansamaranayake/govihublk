"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const DISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
  Anuradhapura: { lat: 8.3114, lng: 80.4037 },
  Polonnaruwa: { lat: 7.9403, lng: 81.0188 },
  Colombo: { lat: 6.9271, lng: 79.8612 },
  Kurunegala: { lat: 7.4863, lng: 80.3647 },
  Kandy: { lat: 7.2906, lng: 80.6337 },
  Matale: { lat: 7.4675, lng: 80.6234 },
  Galle: { lat: 6.0535, lng: 80.2210 },
  Jaffna: { lat: 9.6615, lng: 80.0255 },
  Batticaloa: { lat: 7.7310, lng: 81.6747 },
  Badulla: { lat: 6.9934, lng: 81.0550 },
  Ratnapura: { lat: 6.6828, lng: 80.4028 },
  Trincomalee: { lat: 8.5874, lng: 81.2152 },
  Hambantota: { lat: 6.1429, lng: 81.1212 },
  Matara: { lat: 5.9549, lng: 80.5550 },
  Nuwara_Eliya: { lat: 6.9497, lng: 80.7891 },
};

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
  weather: { temp: 29, condition: "Partly Cloudy", humidity: 72, location: "Anuradhapura" },
  marketPrices: [
    { crop: "Samba Rice", price: 120, unit: "kg", change: 8 },
    { crop: "Big Onions", price: 85, unit: "kg", change: -3 },
    { crop: "Green Chili", price: 155, unit: "kg", change: 12 },
    { crop: "Tomato", price: 200, unit: "kg", change: 0 },
  ],
  recentActivity: [
    { id: "1", type: "match", message: "New match for your Samba Rice listing", time: "2h ago" },
    { id: "2", type: "offer", message: "Buyer accepted your price for Big Onions", time: "5h ago" },
    { id: "3", type: "diagnosis", message: "Crop diagnosis completed", time: "1d ago" },
  ],
};

export default function FarmerDashboardPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  useEffect(() => {
    const userDistrict = user?.district || "Anuradhapura";
    const coords = DISTRICT_COORDS[userDistrict] || DISTRICT_COORDS["Anuradhapura"];
    const query = `?district=${encodeURIComponent(userDistrict)}&lat=${coords.lat}&lng=${coords.lng}`;

    api.get<DashboardData>(`/farmer/dashboard${query}`)
      .then((res) => {
        // Ensure weather location matches user's district
        if (res.weather) {
          res.weather.location = userDistrict;
        }
        setData(res);
      })
      .catch(() => {
        const mock = { ...MOCK, weather: { ...MOCK.weather, location: userDistrict } };
        if (user?.name) mock.farmerName = user.name;
        setData(mock);
      })
      .finally(() => setLoading(false));
  }, [user]);

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
