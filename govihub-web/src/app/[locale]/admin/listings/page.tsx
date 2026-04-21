"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge, type ListingStatus } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cropName, formatDateSafe } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

// ── Types ────────────────────────────────────────────────────────────────────
interface Listing {
  id: string;
  owner_name: string;
  crop: string;
  quantity: number;
  unit: string;
  status: ListingStatus;
  district: string;
  created_at: string;
  price_per_kg?: number;
  min_price_per_kg?: number;
  max_price_per_kg?: number;
  description?: string;
  quality_grade?: string;
  harvest_date?: string;
  available_from?: string;
  available_until?: string;
  needed_by?: string;
  is_organic?: boolean;
  delivery_available?: boolean;
  delivery_radius_km?: number;
  variety?: string;
  images?: string[];
  phone?: string;
  email?: string;
}


// ── Status filter options ────────────────────────────────────────────────────
const ALL_STATUSES: ListingStatus[] = [
  "planned", "ready", "matched", "fulfilled", "expired", "cancelled",
  "open", "reviewing", "confirmed", "closed",
];

// ── Component ────────────────────────────────────────────────────────────────
export default function AdminListingsPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { isReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [harvests, setHarvests] = useState<Listing[]>([]);
  const [demands, setDemands] = useState<Listing[]>([]);
  const [supply, setSupply] = useState<Listing[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [activeListingType, setActiveListingType] = useState<string>("harvests");

  useEffect(() => {
    if (!isReady) return;
    async function fetchData() {
      try {
        // Try /admin/listings first, fall back to individual listing endpoints
        const [h, d, s] = await Promise.all([
          api.get<Listing[]>("/admin/listings?type=harvest").catch(() =>
            api.get<Listing[]>("/listings/harvest").catch(() => [] as Listing[])
          ),
          api.get<Listing[]>("/admin/listings?type=demand").catch(() =>
            api.get<Listing[]>("/listings/demand").catch(() => [] as Listing[])
          ),
          api.get<Listing[]>("/admin/listings?type=supply").catch(() =>
            api.get<Listing[]>("/marketplace/search").catch(() => [] as Listing[])
          ),
        ]);
        setHarvests(Array.isArray(h) ? h : []);
        setDemands(Array.isArray(d) ? d : []);
        setSupply(Array.isArray(s) ? s : []);
      } catch {
        setHarvests([]);
        setDemands([]);
        setSupply([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [isReady]);

  const filterByStatus = (items: Listing[]) =>
    statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter);

  const truncateId = (id: string) => id.slice(0, 10) + "...";

  const formatDate = (d: string) => {
    if (!d) return "";
    const iso = d.split("T")[0];
    const [y, m, day] = iso.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m,10)-1]} ${parseInt(day,10)}, ${y}`;
  };

  const tabs = [
    { key: "harvests", label: "Harvests", badge: harvests.length },
    { key: "demands", label: "Demands", badge: demands.length },
    { key: "supply", label: "Supply", badge: supply.length },
  ];

  const dataMap: Record<string, Listing[]> = {
    harvests,
    demands,
    supply,
  };

  const ownerLabel: Record<string, string> = {
    harvests: "Farmer",
    demands: "Buyer",
    supply: "Supplier",
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Listings Management</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Review and manage all marketplace listings
          </p>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs + Table */}
      <Card padding="none">
        <Tabs tabs={tabs}>
          {(activeTab) => {
            const items = filterByStatus(dataMap[activeTab] || []);
            if (items.length === 0) {
              return (
                <EmptyState
                  title="No listings found"
                  description={
                    statusFilter !== "all"
                      ? "Try changing the status filter."
                      : "No listings in this category yet."
                  }
                />
              );
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                      <th className="px-4 py-3 font-medium text-neutral-600">ID</th>
                      <th className="px-4 py-3 font-medium text-neutral-600">
                        {ownerLabel[activeTab]}
                      </th>
                      <th className="px-4 py-3 font-medium text-neutral-600">Crop</th>
                      <th className="px-4 py-3 font-medium text-neutral-600">Qty</th>
                      <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
                      <th className="px-4 py-3 font-medium text-neutral-600">District</th>
                      <th className="px-4 py-3 font-medium text-neutral-600">Date</th>
                      <th className="px-4 py-3 font-medium text-neutral-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-neutral-100 hover:bg-green-50/40 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                          {truncateId(item.id)}
                        </td>
                        <td className="px-4 py-3 font-medium text-neutral-800">
                          {item.owner_name}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">{cropName(item.crop, locale)}</td>
                        <td className="px-4 py-3 text-neutral-700">
                          {item.quantity?.toLocaleString()} {item.unit}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{item.district}</td>
                        <td className="px-4 py-3 text-neutral-500 text-xs">
                          {formatDate(item.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setActiveListingType(activeTab); setSelectedListing(item); }}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }}
        </Tabs>
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedListing}
        onClose={() => setSelectedListing(null)}
        title="Listing Details"
        size="lg"
        footer={
          <Button variant="secondary" fullWidth onClick={() => setSelectedListing(null)}>
            Close
          </Button>
        }
      >
        {selectedListing && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-neutral-400">{selectedListing.id}</span>
              <StatusBadge status={selectedListing.status} />
            </div>

            {/* Owner & Crop */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">
                  {ownerLabel[activeListingType] || "Owner"}
                </p>
                <p className="text-sm font-semibold text-neutral-800">{selectedListing.owner_name}</p>
                {selectedListing.district && (
                  <p className="text-xs text-neutral-500 mt-0.5">📍 {selectedListing.district}</p>
                )}
                {selectedListing.phone && (
                  <p className="text-xs text-neutral-500 mt-0.5">📞 {selectedListing.phone}</p>
                )}
                {selectedListing.email && (
                  <p className="text-xs text-neutral-500 mt-0.5">📧 {selectedListing.email}</p>
                )}
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Crop</p>
                <p className="text-sm font-semibold text-neutral-800">{cropName(selectedListing.crop, locale)}</p>
                {selectedListing.variety && (
                  <p className="text-xs text-neutral-500 mt-0.5">Variety: {selectedListing.variety}</p>
                )}
                {selectedListing.quality_grade && (
                  <p className="text-xs text-neutral-500 mt-0.5">Grade: {selectedListing.quality_grade}</p>
                )}
              </div>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-neutral-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-neutral-800">
                  {selectedListing.quantity?.toLocaleString()}
                </p>
                <p className="text-[10px] text-neutral-500 uppercase">{selectedListing.unit || "kg"}</p>
              </div>
              <div className="bg-neutral-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-green-700">
                  {selectedListing.price_per_kg
                    ? `Rs. ${selectedListing.price_per_kg}`
                    : selectedListing.max_price_per_kg
                      ? `Rs. ${selectedListing.max_price_per_kg}`
                      : "—"}
                </p>
                <p className="text-[10px] text-neutral-500 uppercase">
                  {selectedListing.max_price_per_kg ? "Max Price/kg" : "Price/kg"}
                </p>
              </div>
              {selectedListing.min_price_per_kg && (
                <div className="bg-neutral-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-amber-700">
                    Rs. {selectedListing.min_price_per_kg}
                  </p>
                  <p className="text-[10px] text-neutral-500 uppercase">Min Price/kg</p>
                </div>
              )}
              <div className="bg-neutral-50 rounded-xl p-3 text-center">
                <p className="text-sm font-semibold text-neutral-800">
                  {formatDate(selectedListing.created_at)}
                </p>
                <p className="text-[10px] text-neutral-500 uppercase">Created</p>
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Dates</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedListing.harvest_date && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Harvest Date</span>
                    <span className="font-medium">{formatDate(selectedListing.harvest_date)}</span>
                  </div>
                )}
                {selectedListing.available_from && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Available From</span>
                    <span className="font-medium">{formatDate(selectedListing.available_from)}</span>
                  </div>
                )}
                {selectedListing.available_until && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Available Until</span>
                    <span className="font-medium">{formatDate(selectedListing.available_until)}</span>
                  </div>
                )}
                {selectedListing.needed_by && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Needed By</span>
                    <span className="font-medium">{formatDate(selectedListing.needed_by)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {selectedListing.is_organic && (
                <Badge color="green" size="sm">🌿 Organic</Badge>
              )}
              {selectedListing.delivery_available && (
                <Badge color="blue" size="sm">
                  🚚 Delivery Available
                  {selectedListing.delivery_radius_km ? ` (${selectedListing.delivery_radius_km} km)` : ""}
                </Badge>
              )}
            </div>

            {/* Description */}
            {selectedListing.description && (
              <div>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-neutral-700 bg-neutral-50 rounded-lg p-3">{selectedListing.description}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
