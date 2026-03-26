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
import { cropName } from "@/lib/utils";
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
  description?: string;
}

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_HARVESTS: Listing[] = [
  { id: "h-a1b2c3d4", owner_name: "Kamal Perera", crop: "Rice (Samba)", quantity: 500, unit: "kg", status: "ready", district: "Anuradhapura", created_at: "2026-03-20", price_per_kg: 120, description: "Freshly harvested samba rice, organic" },
  { id: "h-e5f6g7h8", owner_name: "Nimal Silva", crop: "Red Onions", quantity: 200, unit: "kg", status: "matched", district: "Polonnaruwa", created_at: "2026-03-18", price_per_kg: 350 },
  { id: "h-i9j0k1l2", owner_name: "Sunil Fernando", crop: "Green Chilli", quantity: 80, unit: "kg", status: "planned", district: "Anuradhapura", created_at: "2026-03-15", price_per_kg: 500 },
  { id: "h-m3n4o5p6", owner_name: "Priya Kumari", crop: "Tomatoes", quantity: 150, unit: "kg", status: "fulfilled", district: "Polonnaruwa", created_at: "2026-03-10" },
  { id: "h-q7r8s9t0", owner_name: "Ranjith Bandara", crop: "Coconut", quantity: 1000, unit: "nuts", status: "expired", district: "Anuradhapura", created_at: "2026-02-28" },
  { id: "h-u1v2w3x4", owner_name: "Amara Jayasena", crop: "Bitter Gourd", quantity: 60, unit: "kg", status: "cancelled", district: "Polonnaruwa", created_at: "2026-02-20" },
];

const MOCK_DEMANDS: Listing[] = [
  { id: "d-a1b2c3d4", owner_name: "Fresh Lanka Co.", crop: "Rice (Samba)", quantity: 2000, unit: "kg", status: "open", district: "Anuradhapura", created_at: "2026-03-22", price_per_kg: 115 },
  { id: "d-e5f6g7h8", owner_name: "Colombo Mart", crop: "Red Onions", quantity: 500, unit: "kg", status: "reviewing", district: "Polonnaruwa", created_at: "2026-03-19" },
  { id: "d-i9j0k1l2", owner_name: "Lanka Foods PLC", crop: "Green Chilli", quantity: 300, unit: "kg", status: "confirmed", district: "Anuradhapura", created_at: "2026-03-16" },
  { id: "d-m3n4o5p6", owner_name: "Hotel Kingsbury", crop: "Tomatoes", quantity: 100, unit: "kg", status: "closed", district: "Polonnaruwa", created_at: "2026-03-12" },
  { id: "d-q7r8s9t0", owner_name: "Keells Super", crop: "Coconut", quantity: 5000, unit: "nuts", status: "open", district: "Anuradhapura", created_at: "2026-03-08" },
];

const MOCK_SUPPLY: Listing[] = [
  { id: "s-a1b2c3d4", owner_name: "Agri Suppliers Ltd", crop: "NPK Fertilizer", quantity: 100, unit: "bags", status: "ready", district: "Anuradhapura", created_at: "2026-03-21" },
  { id: "s-e5f6g7h8", owner_name: "CIC Agri", crop: "Rice Seeds (BG 352)", quantity: 50, unit: "kg", status: "matched", district: "Polonnaruwa", created_at: "2026-03-17" },
  { id: "s-i9j0k1l2", owner_name: "Lanka Fertilizers", crop: "Urea", quantity: 200, unit: "bags", status: "ready", district: "Anuradhapura", created_at: "2026-03-14" },
  { id: "s-m3n4o5p6", owner_name: "Hayleys Agro", crop: "Pesticide (Bio)", quantity: 30, unit: "liters", status: "fulfilled", district: "Polonnaruwa", created_at: "2026-03-09" },
  { id: "s-q7r8s9t0", owner_name: "Green Solutions", crop: "Drip Irrigation Kit", quantity: 10, unit: "sets", status: "planned", district: "Anuradhapura", created_at: "2026-03-05" },
];

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
        // Fallback to mock data
        setHarvests(MOCK_HARVESTS);
        setDemands(MOCK_DEMANDS);
        setSupply(MOCK_SUPPLY);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [isReady]);

  const filterByStatus = (items: Listing[]) =>
    statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter);

  const truncateId = (id: string) => id.slice(0, 10) + "...";

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-LK", { month: "short", day: "numeric", year: "numeric" });

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
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedListing(item)}
                        className="border-b border-neutral-100 hover:bg-green-50/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                          {truncateId(item.id)}
                        </td>
                        <td className="px-4 py-3 font-medium text-neutral-800">
                          {item.owner_name}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">{cropName(item.crop, locale)}</td>
                        <td className="px-4 py-3 text-neutral-700">
                          {item.quantity.toLocaleString()} {item.unit}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{item.district}</td>
                        <td className="px-4 py-3 text-neutral-500 text-xs">
                          {formatDate(item.created_at)}
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

      {/* Detail modal overlay */}
      {selectedListing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelectedListing(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">Listing Details</h2>
              <button
                onClick={() => setSelectedListing(null)}
                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-neutral-400">{selectedListing.id}</span>
                <StatusBadge status={selectedListing.status} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-neutral-500">Owner</p>
                  <p className="font-medium text-neutral-800">{selectedListing.owner_name}</p>
                </div>
                <div>
                  <p className="text-neutral-500">Crop</p>
                  <p className="font-medium text-neutral-800">{cropName(selectedListing.crop, locale)}</p>
                </div>
                <div>
                  <p className="text-neutral-500">Quantity</p>
                  <p className="font-medium text-neutral-800">
                    {selectedListing.quantity.toLocaleString()} {selectedListing.unit}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-500">District</p>
                  <p className="font-medium text-neutral-800">{selectedListing.district}</p>
                </div>
                {selectedListing.price_per_kg && (
                  <div>
                    <p className="text-neutral-500">Price per kg</p>
                    <p className="font-medium text-green-700">
                      Rs. {selectedListing.price_per_kg.toLocaleString()}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-neutral-500">Created</p>
                  <p className="font-medium text-neutral-800">
                    {formatDate(selectedListing.created_at)}
                  </p>
                </div>
              </div>

              {selectedListing.description && (
                <div>
                  <p className="text-neutral-500 text-sm">Description</p>
                  <p className="text-sm text-neutral-700 mt-1">{selectedListing.description}</p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-neutral-200 flex justify-end">
              <button
                onClick={() => setSelectedListing(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
