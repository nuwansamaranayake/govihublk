"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";

// ── Types ──────────────────────────────────────────────────────────────
interface HourlyEntry {
  time: string;
  temp: number | null;
  humidity: number | null;
  precipitation_mm: number;
  precipitation_probability: number;
  soil_temp_6cm: number | null;
  soil_moisture: number | null;
  wind_speed_kmh: number;
  cloud_cover: number;
}

interface DaySummary {
  temp_max: number | null;
  temp_min: number | null;
  precipitation_mm: number;
  precipitation_prob: number;
  wind_max_kmh: number;
  uv_index: number;
  icon: string;
  condition: string;
  day_name_si: string;
  day_name_en: string;
}

interface SoilConditions {
  current_soil_temp_6cm: number | null;
  current_soil_moisture: number | null;
  soil_temp_trend: string;
  interpretation_si: string;
  interpretation_en: string;
}

interface CropNote {
  crop_type: string;
  name_si: string;
  note_si: string;
  note_en: string;
}

interface HourlyData {
  date: string;
  location: string;
  summary: DaySummary;
  hourly: HourlyEntry[];
  soil_conditions: SoilConditions | null;
  crop_notes: CropNote[];
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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function tempColor(temp: number | null): string {
  if (temp == null) return "bg-neutral-200";
  if (temp >= 35) return "bg-red-400";
  if (temp >= 30) return "bg-orange-400";
  if (temp >= 25) return "bg-amber-400";
  if (temp >= 20) return "bg-yellow-300";
  if (temp >= 15) return "bg-green-300";
  return "bg-blue-300";
}

function moistureColor(m: number | null): string {
  if (m == null) return "bg-neutral-200";
  const pct = m * 100;
  if (pct >= 60) return "bg-blue-500";
  if (pct >= 40) return "bg-blue-400";
  if (pct >= 25) return "bg-sky-400";
  if (pct >= 15) return "bg-sky-300";
  return "bg-amber-300";
}

// ── Simple Bar Chart ───────────────────────────────────────────────────
function MiniBarChart({
  data,
  maxVal,
  colorFn,
  unit,
  label,
  hours,
}: {
  data: (number | null)[];
  maxVal: number;
  colorFn: (v: number | null) => string;
  unit: string;
  label: string;
  hours: string[];
}) {
  const safeMax = maxVal > 0 ? maxVal : 1;

  return (
    <div>
      <p className="text-xs font-semibold text-neutral-700 mb-2">{label}</p>
      <div className="flex items-end gap-[2px] h-20">
        {data.map((v, i) => {
          const pct = v != null ? Math.max((v / safeMax) * 100, 4) : 4;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end group relative"
            >
              <div
                className={`w-full rounded-t-sm ${colorFn(v)} transition-all`}
                style={{ height: `${pct}%` }}
              />
              {/* Tooltip on hover */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-neutral-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {hours[i]} · {v != null ? v.toFixed(1) : "--"}{unit}
              </div>
            </div>
          );
        })}
      </div>
      {/* X-axis labels — show every 4h */}
      <div className="flex gap-[2px] mt-1">
        {hours.map((h, i) => (
          <div key={i} className="flex-1 text-center">
            {i % 4 === 0 ? (
              <span className="text-[8px] text-neutral-400">{h}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────
export default function HourlyDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const dateParam = params?.date as string;
  const { isReady } = useAuth();
  const [data, setData] = useState<HourlyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady || !dateParam) return;
    api
      .get<HourlyData>(`/weather/forecast/${dateParam}`)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [isReady, dateParam]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 pb-24">
        <div className="bg-gradient-to-br from-blue-600 to-sky-500 px-4 pt-12 pb-16 text-white">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-32 mt-2" />
        </div>
        <div className="px-4 -mt-10 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center pb-24">
        <div className="text-center">
          <p className="text-4xl mb-3">{"🌧"}</p>
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

  const { summary, hourly, soil_conditions, crop_notes } = data;
  const dayName = locale === "si" ? summary.day_name_si : summary.day_name_en;
  const dateLabel = formatDateLabel(data.date);

  // Prepare chart data
  const hours = hourly.map((h) => h.time);
  const soilTemps = hourly.map((h) => h.soil_temp_6cm);
  const soilMoistures = hourly.map((h) => h.soil_moisture);
  const maxSoilTemp = Math.max(...soilTemps.filter((v): v is number => v != null), 1);
  const maxMoisture = Math.max(...soilMoistures.filter((v): v is number => v != null), 0.01);

  // Find rain hours
  const rainHourIndexes = new Set(
    hourly.map((h, i) => (h.precipitation_mm > 0 || h.precipitation_probability > 50) ? i : -1).filter((i) => i >= 0)
  );

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-sky-500 px-4 pt-12 pb-16 text-white">
        <button onClick={() => router.back()} className="text-white/70 text-sm mb-2 hover:text-white">
          {"<"} {t("common.back")}
        </button>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs font-medium uppercase tracking-wider">
              {t("weather.hourly")}
            </p>
            <h1 className="text-2xl font-bold mt-1">
              {summary.icon} {dayName}
            </h1>
            <p className="text-blue-100 text-sm mt-1">{dateLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">
              {summary.temp_max != null ? Math.round(summary.temp_max) : "--"}°
            </p>
            <p className="text-blue-200 text-sm">
              {summary.temp_min != null ? Math.round(summary.temp_min) : "--"}°
            </p>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex items-center gap-3 mt-4 text-xs text-blue-100">
          <span>{"🌧"} {summary.precipitation_prob}%</span>
          <span>{"💨"} {Math.round(summary.wind_max_kmh)} km/h</span>
          <span>{"☀️"} UV: {summary.uv_index}</span>
          {summary.precipitation_mm > 0 && <span>{summary.precipitation_mm}mm</span>}
        </div>
      </div>

      <div className="px-4 -mt-10 space-y-4">

        {/* ═══ Soil Temperature Chart ═══ */}
        {soilTemps.some((v) => v != null) && (
          <Card padding="md">
            <MiniBarChart
              data={soilTemps}
              maxVal={maxSoilTemp * 1.2}
              colorFn={tempColor}
              unit="°C"
              label={`🌡 ${t("weather.soilTemp")} (6cm)`}
              hours={hours}
            />
            {soil_conditions && (
              <p className="text-[10px] text-neutral-500 mt-2">
                {locale === "si" ? soil_conditions.interpretation_si : soil_conditions.interpretation_en}
              </p>
            )}
          </Card>
        )}

        {/* ═══ Soil Moisture Chart ═══ */}
        {soilMoistures.some((v) => v != null) && (
          <Card padding="md">
            <MiniBarChart
              data={soilMoistures.map((v) => (v != null ? v * 100 : null))}
              maxVal={maxMoisture * 100 * 1.2}
              colorFn={(v) => moistureColor(v != null ? v / 100 : null)}
              unit="%"
              label={`💧 ${t("weather.soilMoisture")}`}
              hours={hours}
            />
          </Card>
        )}

        {/* ═══ Hourly Table ═══ */}
        <Card padding="none">
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-sm font-bold text-neutral-800">{t("weather.hourly")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-neutral-50 text-neutral-500">
                  <th className="text-left px-3 py-2 font-medium sticky left-0 bg-neutral-50 z-10">
                    {locale === "si" ? "වේලාව" : "Time"}
                  </th>
                  <th className="text-center px-2 py-2 font-medium">°C</th>
                  <th className="text-center px-2 py-2 font-medium">{"💧"}%</th>
                  <th className="text-center px-2 py-2 font-medium">{"🌧"}mm</th>
                  <th className="text-center px-2 py-2 font-medium">{"🌧"}%</th>
                  <th className="text-center px-2 py-2 font-medium">{"💨"}km/h</th>
                  <th className="text-center px-2 py-2 font-medium">{"☁️"}%</th>
                </tr>
              </thead>
              <tbody>
                {hourly.map((h, i) => {
                  const isRainHour = rainHourIndexes.has(i);
                  return (
                    <tr
                      key={i}
                      className={`border-t border-neutral-50 ${
                        isRainHour ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-neutral-50/50"
                      }`}
                    >
                      <td className={`px-3 py-2 font-medium sticky left-0 z-10 ${
                        isRainHour ? "bg-blue-50 text-blue-700" : i % 2 === 0 ? "bg-white" : "bg-neutral-50/50"
                      }`}>
                        {isRainHour && "⚠️ "}{h.time}
                      </td>
                      <td className="text-center px-2 py-2 text-neutral-800 font-semibold">
                        {h.temp != null ? Math.round(h.temp) : "--"}
                      </td>
                      <td className="text-center px-2 py-2 text-neutral-600">
                        {h.humidity != null ? h.humidity : "--"}
                      </td>
                      <td className={`text-center px-2 py-2 ${h.precipitation_mm > 0 ? "text-blue-600 font-semibold" : "text-neutral-400"}`}>
                        {h.precipitation_mm > 0 ? h.precipitation_mm.toFixed(1) : "0"}
                      </td>
                      <td className={`text-center px-2 py-2 ${h.precipitation_probability > 50 ? "text-blue-600 font-semibold" : "text-neutral-500"}`}>
                        {h.precipitation_probability}
                      </td>
                      <td className={`text-center px-2 py-2 ${h.wind_speed_kmh > 30 ? "text-orange-600 font-semibold" : "text-neutral-500"}`}>
                        {Math.round(h.wind_speed_kmh)}
                      </td>
                      <td className="text-center px-2 py-2 text-neutral-500">
                        {Math.round(h.cloud_cover)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ═══ Crop Notes ═══ */}
        {crop_notes.length > 0 && (
          <Card padding="md" className="space-y-3">
            <p className="text-sm font-bold text-neutral-800">
              {"🌿"} {t("weather.cropNotes")}
            </p>
            <div className="space-y-2">
              {crop_notes.map((note, i) => (
                <div key={i} className="flex items-start gap-3 bg-green-50 rounded-xl px-3 py-2.5">
                  <span className="text-lg mt-0.5">{CROP_ICONS[note.crop_type] || "🌱"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-green-800">
                      {locale === "si" ? note.name_si : note.crop_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {locale === "si" ? note.note_si : note.note_en}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Data source */}
        <p className="text-[10px] text-center text-neutral-400 pb-4">
          {t("weather.dataSource")}
        </p>
      </div>
    </div>
  );
}
