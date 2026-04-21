"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// ── Types ──────────────────────────────────────────────────────────────
interface WeatherDay {
  date: string;
  day_name_si?: string;
  day_name_en?: string;
  temp_max: number | null;
  temp_min: number | null;
  precipitation_mm: number;
  precipitation_prob: number;
  wind_max_kmh: number;
  wind_gust_kmh: number;
  uv_index: number;
  evapotranspiration: number;
  sunrise: string | null;
  sunset: string | null;
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
  latitude?: number;
  longitude?: number;
  current: {
    temp: number | null;
    humidity: number | null;
    icon: string;
    condition: string;
    wind_speed: number | null;
  };
  daily: WeatherDay[];
  crop_alerts: CropAlert[];
  soil_conditions?: SoilConditions;
  fetched_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_NAMES_SI = ["ඉරිදා", "සඳුදා", "අඟහරුවාදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"];
const DAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_SHORT_SI = ["ඉරි", "සඳු", "අඟ", "බදා", "බ්‍රහ", "සිකු", "සෙන"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDay(dateStr: string, locale: string, index: number): { dayName: string; dateLabel: string; shortDay: string } {
  if (index === 0) return { dayName: locale === "si" ? "අද" : "Today", dateLabel: dateStr, shortDay: locale === "si" ? "අද" : "TODAY" };
  if (index === 1) return { dayName: locale === "si" ? "හෙට" : "Tomorrow", dateLabel: dateStr, shortDay: locale === "si" ? "හෙට" : "TMR" };
  try {
    const d = new Date(dateStr + "T00:00:00");
    const names = locale === "si" ? DAY_NAMES_SI : DAY_NAMES;
    const shorts = locale === "si" ? DAY_SHORT_SI : DAY_SHORT;
    const monthDay = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    return { dayName: names[d.getDay()], dateLabel: monthDay, shortDay: shorts[d.getDay()] };
  } catch {
    return { dayName: dateStr, dateLabel: "", shortDay: "" };
  }
}

function uvLevel(uv: number): { label: string; color: string } {
  if (uv <= 2) return { label: "Low", color: "text-green-600" };
  if (uv <= 5) return { label: "Moderate", color: "text-amber-500" };
  if (uv <= 7) return { label: "High", color: "text-orange-500" };
  if (uv <= 10) return { label: "Very High", color: "text-red-500" };
  return { label: "Extreme", color: "text-purple-600" };
}

// ── Component ──────────────────────────────────────────────────────────
export default function WeatherForecastPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const { isReady } = useAuth();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    api
      .get<WeatherData>("/weather/forecast?days=7")
      .then((w) => setWeather(w))
      .catch(() => setWeather(null))
      .finally(() => setLoading(false));
  }, [isReady]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 pb-24">
        <div className="bg-gradient-to-br from-blue-600 to-sky-500 px-4 pt-12 pb-16 text-white">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-32 mt-2" />
        </div>
        <div className="px-4 -mt-10 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center pb-24">
        <div className="text-center">
          <p className="text-4xl mb-3">🌧</p>
          <p className="font-semibold text-neutral-700">{t("weather.unavailable")}</p>
          <p className="text-sm text-neutral-500 mt-1">{t("weather.tryAgainLater")}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
          >
            {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  const reliableDays = weather.daily.filter((_, i) => i < 3);
  const outlookDays = weather.daily.filter((_, i) => i >= 3);

  // Get alerts per date
  const alertsByDate: Record<string, CropAlert[]> = {};
  for (const alert of weather.crop_alerts || []) {
    if (!alertsByDate[alert.date]) alertsByDate[alert.date] = [];
    alertsByDate[alert.date].push(alert);
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-sky-500 px-4 pt-12 pb-16 text-white">
        <button onClick={() => router.back()} className="text-white/70 text-sm mb-2 hover:text-white">
          ← {t("common.back")}
        </button>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs font-medium uppercase tracking-wider">
              {t("weather.title")}
            </p>
            <h1 className="text-2xl font-bold mt-1">📍 {weather.location}</h1>
            <p className="text-blue-100 text-sm mt-1">
              {weather.current.condition} · {weather.current.temp != null ? Math.round(weather.current.temp) : "--"}°C
            </p>
          </div>
          <span className="text-6xl" aria-hidden="true">{weather.current.icon}</span>
        </div>
      </div>

      <div className="px-4 -mt-10 space-y-4">

        {/* ═══ Reliable Forecast (Days 1-3) ═══ */}
        <div className="flex items-center gap-2 pt-2">
          <div className="h-px flex-1 bg-green-300" />
          <span className="text-xs font-bold text-green-700 uppercase tracking-wider">
            {t("weather.reliable")}
          </span>
          <div className="h-px flex-1 bg-green-300" />
        </div>

        {reliableDays.map((day, i) => {
          const { dayName, dateLabel } = formatDay(day.date, locale, i);
          const dayAlerts = alertsByDate[day.date] || [];

          return (
            <Card key={day.date} padding="md" className="space-y-3">
              {/* Day header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-neutral-800">{dayName}</p>
                  <p className="text-[10px] text-neutral-400">{dateLabel}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-bold text-neutral-800">
                      {day.icon} {day.temp_max != null ? Math.round(day.temp_max) : "--"}° / {day.temp_min != null ? Math.round(day.temp_min) : "--"}°
                    </p>
                  </div>
                </div>
              </div>

              {/* Weather details row */}
              <div className="flex items-center gap-4 text-[11px] text-neutral-500">
                <span>🌧 {day.precipitation_prob}%</span>
                <span>💨 {Math.round(day.wind_max_kmh)} km/h</span>
                <span className={uvLevel(day.uv_index).color}>☀️ UV: {day.uv_index}</span>
                {day.precipitation_mm > 0 && <span className="text-blue-600">{day.precipitation_mm}mm</span>}
              </div>

              {/* Soil + ET row */}
              {i === 0 && weather.soil_conditions && weather.soil_conditions.current_soil_temp_6cm != null && (
                <div className="flex items-center gap-3 text-[11px] bg-amber-50 rounded-lg px-3 py-1.5">
                  <span>🌱 {locale === "si" ? "පස" : "Soil"}: {weather.soil_conditions.current_soil_temp_6cm}°C</span>
                  <span>💧 {Math.round((weather.soil_conditions.current_soil_moisture || 0) * 100)}%</span>
                  <span>🌿 ET₀: {day.evapotranspiration}mm</span>
                </div>
              )}

              {/* Sun times */}
              <div className="flex items-center gap-4 text-[10px] text-neutral-400">
                <span>🌅 {day.sunrise ? day.sunrise.split("T")[1]?.slice(0, 5) || day.sunrise : "--"}</span>
                <span>🌇 {day.sunset ? day.sunset.split("T")[1]?.slice(0, 5) || day.sunset : "--"}</span>
              </div>

              {/* Crop alerts for this day */}
              {dayAlerts.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-neutral-100">
                  {dayAlerts.map((alert, j) => {
                    const color = alert.severity === "good" ? "text-green-700" :
                                  alert.severity === "warning" ? "text-amber-700" :
                                  alert.severity === "critical" ? "text-red-700" : "text-blue-700";
                    return (
                      <p key={j} className={`text-xs ${color}`}>
                        {alert.icon} <span className="font-semibold">{locale === "si" ? alert.crop_name_si : alert.crop}</span>:{" "}
                        {locale === "si" && alert.message_si ? alert.message_si : alert.message_en}
                      </p>
                    );
                  })}
                </div>
              )}

              {/* Hourly link */}
              <button
                onClick={() => router.push(`/${locale}/farmer/weather/${day.date}`)}
                className="w-full text-center py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                {t("weather.viewHourly")}
              </button>
            </Card>
          );
        })}

        {/* ═══ Extended Outlook (Days 4-7) ═══ */}
        {outlookDays.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-neutral-300" />
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                {t("weather.outlook")}
              </span>
              <div className="h-px flex-1 bg-neutral-300" />
            </div>

            <Card padding="none">
              <div className="divide-y divide-neutral-50">
                {outlookDays.map((day, i) => {
                  const { shortDay, dateLabel } = formatDay(day.date, locale, i + 3);
                  return (
                    <div key={day.date} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg w-6 text-center">{day.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-neutral-700">{shortDay}</p>
                          <p className="text-[10px] text-neutral-400">{dateLabel}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-bold text-neutral-800">
                          {day.temp_max != null ? Math.round(day.temp_max) : "--"}°/
                          <span className="text-neutral-400 font-normal">{day.temp_min != null ? Math.round(day.temp_min) : "--"}°</span>
                        </span>
                        <span className="text-[11px] text-blue-500 w-12 text-right">🌧 {day.precipitation_prob}%</span>
                        {day.precipitation_mm > 0 && (
                          <span className="text-[11px] text-blue-600 w-12 text-right">{day.precipitation_mm}mm</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}

        {/* Data source */}
        <p className="text-[10px] text-center text-neutral-400 pb-4">
          {t("weather.dataSource")}
        </p>
      </div>
    </div>
  );
}
