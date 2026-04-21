"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";

// ── Types ──────────────────────────────────────────────────────────────
interface WeatherAlert {
  id: string;
  crop_type: string;
  crop_name_si: string;
  alert_type: string;
  severity: string;
  forecast_date: string;
  message_si: string;
  message_en: string | null;
  is_read: boolean;
  created_at: string | null;
  weather_data: Record<string, unknown> | null;
}

interface AlertsResponse {
  alerts: WeatherAlert[];
  unread_count: number;
  total: number;
}

// ── Helpers ────────────────────────────────────────────────────────────
const CROP_ICONS: Record<string, string> = {
  black_pepper: "\u{1F336}",
  cinnamon: "\u{1F33F}",
  turmeric: "\u{1F7E1}",
  ginger: "\u{1FAD0}",
  cloves: "\u{1F338}",
  nutmeg: "\u{1F95C}",
  cardamom: "\u{1F49A}",
  mixed_spices: "\u{1F33F}",
};

const ALERT_TYPE_ICONS: Record<string, string> = {
  heavy_rain: "\u{1F327}",
  high_wind: "\u{1F32C}",
  dry_spell: "\u{2600}",
  heat_stress: "\u{1F525}",
  cold_stress: "\u{1F976}",
  cold_soil: "\u{1F9CA}",
  hot_soil: "\u{1F321}",
  humidity_high: "\u{1F4A7}",
  humidity_heat: "\u{1F975}",
  waterlog: "\u{1F30A}",
  rain_prob: "\u{1F327}",
};

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  critical: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", badge: "bg-red-500 text-white" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", badge: "bg-amber-500 text-white" },
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", badge: "bg-blue-500 text-white" },
  good: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", badge: "bg-green-500 text-white" },
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatForecastDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  } catch {
    return dateStr;
  }
}

function timeAgo(isoStr: string | null, locale: string): string {
  if (!isoStr) return "";
  try {
    const created = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return locale === "si" ? "දැන්" : "Just now";
    if (diffHours < 24) return locale === "si" ? `පැය ${diffHours} කට කලින්` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return locale === "si" ? "ඊයේ" : "Yesterday";
    if (diffDays < 7) return locale === "si" ? `දින ${diffDays} කට කලින්` : `${diffDays}d ago`;
    return formatForecastDate(isoStr.split("T")[0]);
  } catch {
    return "";
  }
}

function groupByDate(alerts: WeatherAlert[]): { label: string; date: string; alerts: WeatherAlert[] }[] {
  const groups: Record<string, WeatherAlert[]> = {};
  for (const alert of alerts) {
    const key = alert.forecast_date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(alert);
  }

  // Sort dates descending (most recent first)
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return sortedDates.map((date) => ({
    label: formatForecastDate(date),
    date,
    alerts: groups[date],
  }));
}

// ── Component ──────────────────────────────────────────────────────────
export default function AlertsPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const { isReady } = useAuth();
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await api.get<AlertsResponse>("/weather/alerts");
      setAlerts(res.alerts);
      setUnreadCount(res.unread_count);
      setTotal(res.total);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    loadAlerts();
  }, [isReady, loadAlerts]);

  const markAsRead = async (alertId: string) => {
    try {
      await api.put(`/weather/alerts/${alertId}/read`, {});
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
  };

  const markAllRead = async () => {
    try {
      await api.put("/weather/alerts/read-all", {});
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 pb-24">
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 px-4 pt-12 pb-16 text-white">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-32 mt-2" />
        </div>
        <div className="px-4 -mt-10 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const groups = groupByDate(alerts);

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-500 px-4 pt-12 pb-16 text-white">
        <button onClick={() => router.back()} className="text-white/70 text-sm mb-2 hover:text-white">
          {"<"} {t("common.back")}
        </button>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-amber-200 text-xs font-medium uppercase tracking-wider">
              {t("alerts.title")}
            </p>
            <h1 className="text-2xl font-bold mt-1">
              {"🔔"} {t("alerts.title")}
            </h1>
            {total > 0 && (
              <p className="text-amber-100 text-sm mt-1">
                {unreadCount > 0
                  ? locale === "si"
                    ? `නොකියවූ ${unreadCount}ක්`
                    : `${unreadCount} unread`
                  : locale === "si"
                  ? "සියල්ල කියවා ඇත"
                  : "All read"}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-medium text-white hover:bg-white/30 transition-colors"
            >
              {t("alerts.markAllRead")}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 -mt-10 space-y-4">
        {/* Empty state */}
        {alerts.length === 0 && (
          <Card padding="md" className="text-center py-12">
            <p className="text-4xl mb-3">{"🌤"}</p>
            <p className="font-semibold text-neutral-700">{t("alerts.noAlerts")}</p>
            <p className="text-sm text-neutral-500 mt-1">{t("alerts.noAlertsDesc")}</p>
            <button
              onClick={() => router.push(`/${locale}/farmer/weather`)}
              className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
            >
              {t("weather.viewForecast")}
            </button>
          </Card>
        )}

        {/* Grouped alerts by forecast date */}
        {groups.map((group) => (
          <div key={group.date} className="space-y-2">
            {/* Date header */}
            <div className="flex items-center gap-2 pt-1">
              <div className="h-px flex-1 bg-neutral-200" />
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                {"📅"} {group.label}
              </span>
              <div className="h-px flex-1 bg-neutral-200" />
            </div>

            {/* Alerts for this date */}
            {group.alerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
              const cropIcon = CROP_ICONS[alert.crop_type] || "🌱";
              const alertIcon = ALERT_TYPE_ICONS[alert.alert_type] || "⚠️";
              const cropName = locale === "si"
                ? alert.crop_name_si
                : alert.crop_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              const message = locale === "si" ? alert.message_si : (alert.message_en || alert.message_si);
              const when = timeAgo(alert.created_at, locale);

              return (
                <button
                  key={alert.id}
                  onClick={() => !alert.is_read && markAsRead(alert.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${cfg.bg} ${cfg.border} ${
                    !alert.is_read ? "shadow-sm" : "opacity-75"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon stack */}
                    <div className="flex flex-col items-center gap-0.5 pt-0.5">
                      <span className="text-lg">{alertIcon}</span>
                      <span className="text-xs">{cropIcon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
                          {t(`alerts.severity.${alert.severity}`)}
                        </span>
                        <span className="text-xs font-semibold text-neutral-700">
                          {cropName}
                        </span>
                        {!alert.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 ml-auto shrink-0" />
                        )}
                      </div>
                      <p className={`text-xs ${cfg.text} leading-relaxed`}>
                        {message}
                      </p>
                      {when && (
                        <p className="text-[10px] text-neutral-400 mt-1.5">{when}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}

        {/* Data source */}
        {alerts.length > 0 && (
          <p className="text-[10px] text-center text-neutral-400 pb-4">
            {t("weather.dataSource")}
          </p>
        )}
      </div>
    </div>
  );
}
