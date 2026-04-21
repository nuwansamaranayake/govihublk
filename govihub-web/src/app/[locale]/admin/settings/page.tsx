"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth";

// ── Types ────────────────────────────────────────────────────────────────────
interface SystemInfo {
  app_env: string;
  api_version: string;
  node_count: number;
}

interface HealthStatus {
  database: "healthy" | "unhealthy" | "unknown";
  redis: "healthy" | "unhealthy" | "unknown";
  api: "healthy" | "unhealthy" | "unknown";
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AdminSettingsPage() {
  const t = useTranslations();
  const { isReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    async function fetchData() {
      try {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const [healthRes, dashRes] = await Promise.all([
          api.get<any>("/health").catch(() => null),
          api.get<any>("/admin/dashboard").catch(() => null),
        ]);
        // /health returns {status: "healthy", version, timestamp}
        // If status is healthy, all systems are up (DB+Redis are checked by the health endpoint)
        const allHealthy = healthRes?.status === "healthy" || healthRes?.status === "ok";
        setHealth({
          database: allHealthy ? "healthy" : healthRes ? "unhealthy" : "unknown",
          redis: allHealthy ? "healthy" : healthRes ? "unhealthy" : "unknown",
          api: allHealthy ? "healthy" : healthRes ? "unhealthy" : "unknown",
        });
        setSystemInfo({
          app_env: healthRes?.environment || "production",
          api_version: healthRes?.version || "1.0.0",
          node_count: dashRes?.total_knowledge_chunks ?? 0,
        });
      } catch {
        setSystemInfo({ app_env: "unknown", api_version: "unavailable", node_count: 0 });
        setHealth({ database: "unknown", redis: "unknown", api: "unknown" });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [isReady]);

  const handleClearCache = async () => {
    setClearingCache(true);
    setCacheMessage(null);
    try {
      await api.post("/admin/cache/clear");
      setCacheMessage("Cache cleared successfully.");
    } catch {
      setCacheMessage("Failed to clear cache.");
    } finally {
      setClearingCache(false);
    }
  };

  const healthColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "green" as const;
      case "unhealthy":
        return "red" as const;
      default:
        return "gray" as const;
    }
  };

  const healthLabel = (status: string) => {
    switch (status) {
      case "healthy":
        return "Healthy";
      case "unhealthy":
        return "Unhealthy";
      default:
        return "Unknown";
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" rounded="lg" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" rounded="lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">System configuration and management tools</p>
      </div>

      {/* System Info Card */}
      <Card padding="lg" className="mb-6">
        <h3 className="text-base font-semibold text-neutral-800 mb-4">System Information</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Environment</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge color={systemInfo?.app_env === "production" ? "green" : "gold"} size="md">
                {systemInfo?.app_env || "unknown"}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">API Version</p>
            <p className="mt-1 text-lg font-mono font-semibold text-neutral-800">
              {systemInfo?.api_version || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider">DB Records</p>
            <p className="mt-1 text-lg font-semibold text-neutral-800">
              {systemInfo?.node_count?.toLocaleString() || "—"}
            </p>
          </div>
        </div>
      </Card>

      {/* Settings grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Crop Taxonomy */}
        <Card padding="lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-neutral-800">Crop Taxonomy</h3>
              <p className="text-sm text-neutral-500 mt-1">
                Manage crop categories, varieties, and pricing data
              </p>
            </div>
            <div className="p-2 rounded-xl bg-green-50 text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <a
              href="/en/admin/crops"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
            >
              Manage Crops
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </Card>

        {/* Knowledge Base */}
        <Card padding="lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-neutral-800">Knowledge Base</h3>
              <p className="text-sm text-neutral-500 mt-1">
                Farming tips, advisory content, and AI knowledge
              </p>
            </div>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <a
              href="/en/admin/knowledge"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors"
            >
              Manage Knowledge
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </Card>

        {/* Cache Management */}
        <Card padding="lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-neutral-800">Cache Management</h3>
              <p className="text-sm text-neutral-500 mt-1">
                Clear Redis cache to refresh stale data
              </p>
            </div>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleClearCache}
              disabled={clearingCache}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearingCache ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Clearing...
                </span>
              ) : (
                "Clear Redis Cache"
              )}
            </button>
            {cacheMessage && (
              <span className="text-sm text-green-600 font-medium">{cacheMessage}</span>
            )}
          </div>
        </Card>

        {/* System Health */}
        <Card padding="lg">
          <h3 className="text-base font-semibold text-neutral-800 mb-4">System Health</h3>
          <div className="space-y-3">
            {health &&
              (
                [
                  { key: "database", label: "Database (PostgreSQL)", icon: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" },
                  { key: "redis", label: "Redis", icon: "M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" },
                  { key: "api", label: "API (FastAPI)", icon: "M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" },
                ] as { key: keyof HealthStatus; label: string; icon: string }[]
              ).map(({ key, label, icon }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-neutral-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                    <span className="text-sm font-medium text-neutral-700">{label}</span>
                  </div>
                  <Badge color={healthColor(health[key])} size="sm" dot>
                    {healthLabel(health[key])}
                  </Badge>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
