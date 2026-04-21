"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cropName } from "@/lib/utils";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FEATURES } from "@/config/feature-flags";
import AdCarousel from "@/components/ads/AdCarousel";

// ── Types ──────────────────────────────────────────────────────────────
interface DashboardData {
  farmerName: string;
  activeListings: number;
  activeMatches: number;
  pendingOffers: number;
  marketPrices: { crop: string; price: number; unit: string; change: number }[];
  recentActivity: { id: string; type: string; message: string; time: string }[];
}

interface WeatherCurrent {
  temp: number | null;
  humidity: number | null;
  icon: string;
  condition: string;
  wind_speed: number | null;
}

interface WeatherDay {
  date: string;
  temp_max: number | null;
  temp_min: number | null;
  precipitation_mm: number;
  precipitation_prob: number;
  wind_max_kmh: number;
  icon: string;
  condition: string;
  reliability: string;
}

interface CropAlert {
  crop: string;
  crop_name_si: string;
  type: string;
  severity: string;
  date: string;
  message_en: string;
  message_si?: string;
  icon: string;
}

interface SoilConditions {
  current_soil_temp_6cm: number | null;
  current_soil_moisture: number | null;
  interpretation_si?: string;
  interpretation_en?: string;
}

interface WeatherData {
  location: string;
  current: WeatherCurrent;
  daily: WeatherDay[];
  crop_alerts: CropAlert[];
  soil_conditions?: SoilConditions;
}

// Day name helper
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_SI = ["ඉරි", "සඳු", "අඟ", "බදා", "බ්‍රහ", "සිකු", "සෙන"];

function getDayLabel(dateStr: string, locale: string, index: number): string {
  if (index === 0) return locale === "si" ? "අද" : "Today";
  if (index === 1) return locale === "si" ? "හෙට" : "Tomorrow";
  try {
    const d = new Date(dateStr + "T00:00:00");
    const names = locale === "si" ? DAY_NAMES_SI : DAY_NAMES;
    return names[d.getDay()] || dateStr;
  } catch {
    return dateStr;
  }
}

// ── Component ──────────────────────────────────────────────────────────
export default function FarmerDashboardPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const { user, isReady } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("greeting.morning") : hour < 17 ? t("greeting.afternoon") : t("greeting.evening");

  // Fetch dashboard data
  useEffect(() => {
    if (!isReady) return;

    Promise.all([
      api.get<any>("/users/me").catch(() => null),
      api.get<any>("/listings/harvest").catch(() => null),
      api.get<any>("/matches").catch(() => null),
      FEATURES.SHOW_MARKET_DATA ? api.get<any>("/alerts/prices").catch(() => null) : Promise.resolve(null),
    ])
      .then(([userRes, listingsRes, matchesRes, pricesRes]) => {
        const listings = Array.isArray(listingsRes) ? listingsRes : listingsRes?.data ?? [];
        const matches = Array.isArray(matchesRes) ? matchesRes : matchesRes?.data ?? [];
        const prices = Array.isArray(pricesRes) ? pricesRes : pricesRes?.data ?? [];
        const pendingOffers = matches.filter((m: any) => m.status === "proposed").length;

        setData({
          farmerName: userRes?.name || user?.name || "Farmer",
          activeListings: listings.length,
          activeMatches: matches.length,
          pendingOffers,
          marketPrices: prices.slice(0, 6).map((p: any) => ({
            crop: cropName(p.crop || p.name, locale),
            price: p.price || 0,
            unit: p.unit || "kg",
            change: p.change ?? p.percent_change ?? 0,
          })),
          recentActivity: matches.slice(0, 5).map((m: any) => ({
            id: m.id || String(Math.random()),
            type: "match",
            message: `Match: Score ${Math.round((m.score || 0) * 100)}% · ${m.agreed_price_per_kg ? `Rs. ${m.agreed_price_per_kg}/kg` : "Price TBD"}`,
            time: m.created_at || "",
          })),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isReady, user]);

  // Fetch weather data separately
  useEffect(() => {
    if (!isReady) return;

    api
      .get<WeatherData>("/weather/forecast")
      .then((w) => setWeather(w))
      .catch(() => setWeather(null))
      .finally(() => setWeatherLoading(false));
  }, [isReady]);

  const activityIcon = (type: string) =>
    type === "match" ? "🤝" : type === "offer" ? "💰" : "🔬";

  const severityColor = (s: string) =>
    s === "critical" ? "red" : s === "warning" ? "orange" : "blue";

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
            { label: t("nav.listings"), value: data?.activeListings, colorClass: "text-green-600" },
            { label: t("nav.matches"), value: data?.activeMatches, colorClass: "text-amber-500" },
            { label: t("farmer.offers"), value: data?.pendingOffers, colorClass: "text-blue-600" },
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

        {/* ── Weather Card (Real Data) ───────────────────────────── */}
        <Card padding="none" className="overflow-hidden">
          {/* Current weather header */}
          <div className="bg-gradient-to-r from-blue-50 to-sky-50 px-4 py-3 border-b border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-blue-500 uppercase tracking-wider font-semibold">
                  {t("common.weather")}
                  {weather?.location ? ` — ${weather.location}` : ""}
                </p>
                {weatherLoading ? (
                  <Skeleton className="h-9 w-24 mt-1" />
                ) : weather?.current ? (
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold text-neutral-800">
                      {weather.current.temp != null ? Math.round(weather.current.temp) : "--"}°C
                    </span>
                    <span className="text-sm text-neutral-500 ml-1">{weather.current.condition}</span>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 mt-1">Weather unavailable</p>
                )}
                {!weatherLoading && weather?.current && (
                  <div className="flex gap-3 mt-1 text-xs text-neutral-500">
                    <span>{t("common.humidity")} {weather.current.humidity ?? "--"}%</span>
                    <span>Wind {weather.current.wind_speed ?? "--"} km/h</span>
                  </div>
                )}
              </div>
              <div className="text-5xl" aria-hidden="true">
                {weatherLoading ? "⏳" : weather?.current?.icon || "🌤"}
              </div>
            </div>
          </div>

          {/* 3-day forecast strip */}
          {weatherLoading ? (
            <div className="px-4 py-3">
              <Skeleton className="h-16 w-full" />
            </div>
          ) : weather?.daily && weather.daily.length > 0 ? (
            <div className="grid grid-cols-3 divide-x divide-neutral-100">
              {weather.daily.slice(0, 3).map((day, i) => (
                <div key={day.date} className="text-center py-3 px-2">
                  <p className="text-[10px] font-semibold text-neutral-500 uppercase">
                    {getDayLabel(day.date, locale, i)}
                  </p>
                  <p className="text-xl mt-0.5" aria-hidden="true">{day.icon}</p>
                  <p className="text-sm font-bold text-neutral-800">
                    {day.temp_max != null ? Math.round(day.temp_max) : "--"}°
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    {day.temp_min != null ? Math.round(day.temp_min) : "--"}°
                  </p>
                  <p className="text-[10px] text-blue-500 mt-0.5">
                    🌧 {day.precipitation_prob}%
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {/* Soil conditions */}
          {!weatherLoading && weather?.soil_conditions && weather.soil_conditions.current_soil_temp_6cm != null && (
            <div className="border-t border-neutral-100 px-4 py-2 flex items-center gap-3 bg-amber-50/50">
              <span className="text-sm">🌱</span>
              <p className="text-[11px] text-neutral-600 flex-1">
                {locale === "si"
                  ? `පස: ${weather.soil_conditions.current_soil_temp_6cm}°C | තෙතමනය: ${Math.round((weather.soil_conditions.current_soil_moisture || 0) * 100)}%`
                  : `Soil: ${weather.soil_conditions.current_soil_temp_6cm}°C | Moisture: ${Math.round((weather.soil_conditions.current_soil_moisture || 0) * 100)}%`}
              </p>
            </div>
          )}

          {/* Crop alerts / advisories */}
          {!weatherLoading && weather?.crop_alerts && weather.crop_alerts.length > 0 ? (
            <div className="border-t border-neutral-100 px-4 py-3 space-y-2">
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                {t("weather.forYourCrops")}
              </p>
              {weather.crop_alerts.slice(0, 4).map((alert, i) => {
                const bgColor = alert.severity === "critical" ? "bg-red-50" :
                                alert.severity === "warning" ? "bg-amber-50" :
                                alert.severity === "good" ? "bg-green-50" : "bg-blue-50";
                const textColor = alert.severity === "critical" ? "text-red-700" :
                                  alert.severity === "warning" ? "text-amber-700" :
                                  alert.severity === "good" ? "text-green-700" : "text-blue-700";
                return (
                  <div key={i} className={`flex items-start gap-2 p-2 rounded-lg ${bgColor}`}>
                    <span className="text-sm flex-shrink-0">{alert.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-semibold ${textColor}`}>
                        {locale === "si" ? alert.crop_name_si : alert.crop}
                      </span>
                      <p className="text-[11px] text-neutral-600 mt-0.5">
                        {locale === "si" && alert.message_si ? alert.message_si : alert.message_en}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !weatherLoading && weather && (
            <div className="border-t border-neutral-100 px-4 py-3">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-sm mb-1">💡</p>
                <p className="text-xs text-neutral-600">{t("weather.selectCropsCta")}</p>
                <button
                  onClick={() => router.push(`/${locale}/farmer/more`)}
                  className="mt-2 text-xs font-semibold text-green-600 hover:text-green-700"
                >
                  {t("weather.selectCrops")}
                </button>
              </div>
            </div>
          )}

          {/* Link to full forecast */}
          <button
            onClick={() => router.push(`/${locale}/farmer/weather`)}
            className="w-full text-center py-2.5 border-t border-neutral-100 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            {locale === "si" ? "දින 7 අනාවැකිය බලන්න →" : "View 7-day forecast →"}
          </button>
        </Card>

        {/* Advertisement Carousel */}
        {FEATURES.SHOW_ADS && <AdCarousel />}

        {/* Market Prices — hidden until HARTI price feed is connected */}
        {FEATURES.SHOW_MARKET_DATA && (
        <Card
          header={<h2 className="font-semibold text-neutral-800 text-sm">{t("farmer.marketPricesToday")}</h2>}
          padding="none"
        >
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : data?.marketPrices.length ? (
            <ul className="divide-y divide-neutral-50">
              {data.marketPrices.map((item) => (
                <li key={item.crop} className="flex items-center justify-between px-4 py-3">
                  <span className="font-medium text-neutral-800 text-sm">{cropName(item.crop, locale)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-600">
                      Rs. {item.price}/{item.unit}
                    </span>
                    <Badge
                      color={item.change > 0 ? "green" : item.change < 0 ? "red" : "gray"}
                      size="sm"
                    >
                      {item.change > 0 ? "+" : ""}
                      {item.change}%
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="📊" title={t("common.noMarketData")} />
          )}
        </Card>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="font-semibold text-neutral-800 mb-3 text-sm">{t("home.quickActions")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "🌾", label: t("farmer.addListing"), href: "listings" },
              { icon: "🔬", label: t("farmer.diagnoseCrop"), href: "diagnosis" },
              { icon: "💬", label: t("farmer.askAdvisor"), href: "advisory" },
              { icon: "🛒", label: t("farmer.browseSuppliers"), href: "marketplace" },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 text-center hover:border-green-400 hover:shadow-md transition-all"
              >
                <p className="text-2xl mb-2" aria-hidden="true">
                  {action.icon}
                </p>
                <p className="text-xs font-medium text-neutral-700 leading-tight">{action.label}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <Card
          header={<h2 className="font-semibold text-neutral-800 text-sm">{t("common.recentActivity")}</h2>}
          padding="none"
        >
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
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
            <EmptyState icon="📋" title={t("common.noRecentActivity")} />
          )}
        </Card>
      </div>
    </div>
  );
}
