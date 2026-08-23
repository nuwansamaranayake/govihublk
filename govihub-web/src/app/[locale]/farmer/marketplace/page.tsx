"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { SupplyListingDetailModal } from "@/components/ui/SupplyListingDetailModal";
import { useAuth } from "@/lib/auth";

type Category = "all"|"fertilizer"|"seeds"|"pesticide"|"equipment"|"irrigation";

interface SupplyListing {
  id: string;
  supplier_id: string;
  category: string;
  name: string;
  name_si: string | null;
  description: string | null;
  price: number | null;
  unit: string | null;
  stock_quantity: number | null;
  photos: string[];
  thumbnail: string | null;
  supplier_name: string | null;
  supplier_district: string | null;
  delivery_available: boolean;
  delivery_radius_km: number | null;
  status: string;
  distance_km: number | null;
  created_at: string;
  updated_at: string;
}


const CATEGORY_KEYS: { key: Category; labelKey: string; icon: string }[] = [
  { key:"all", labelKey:"marketplace.catAll", icon:"🏪" },
  { key:"fertilizer", labelKey:"marketplace.catFertilizer", icon:"🌿" },
  { key:"seeds", labelKey:"marketplace.catSeeds", icon:"🌱" },
  { key:"pesticide", labelKey:"marketplace.catPesticide", icon:"🧪" },
  { key:"equipment", labelKey:"marketplace.catEquipment", icon:"🚜" },
  { key:"irrigation", labelKey:"marketplace.catIrrigation", icon:"💧" },
];

export default function FarmerMarketplacePage() {
  const t = useTranslations();
  const { isReady } = useAuth();
  const [listings, setListings] = useState<SupplyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    api.get<any>("/marketplace/search")
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.results ?? res?.data ?? [];
        setListings(items);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load marketplace");
        setListings([]);
      })
      .finally(() => setLoading(false));
  }, [isReady]);

  const searchFiltered = listings.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.supplier_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filtered = searchFiltered
    .filter((s) => category === "all" || s.category === category)
    .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));

  const tabs = CATEGORY_KEYS.map((c) => ({
    key: c.key,
    label: t(c.labelKey),
    badge:
      c.key === "all"
        ? searchFiltered.length
        : searchFiltered.filter((s) => s.category === c.key).length,
  }));

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-green-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("nav.marketplace")}</h1>
        <p className="text-green-200 text-sm mt-1">{t("marketplace.findSuppliers")}</p>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b border-neutral-200">
        <Input
          placeholder={t("marketplace.searchSuppliers")}
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={<span>🔍</span>}
        />
      </div>

      <Tabs tabs={tabs} defaultTab="all" onChange={(k) => setCategory(k as Category)}>
        {() => (
          <div className="px-4 py-4 space-y-3">
            {loading ? (
              Array.from({length:4}).map((_,i) => (
                <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                  <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/3" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <EmptyState icon="🏪" title={t("marketplace.noSuppliersFound")} description={t("marketplace.tryDifferent")} />
            ) : (
              filtered.map(listing => (
                <Card key={listing.id} padding="md" onClick={() => setSelectedId(listing.id)}>
                  <div className="flex items-start gap-3">
                    {listing.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={listing.thumbnail}
                        alt=""
                        loading="lazy"
                        className="w-16 h-16 rounded-lg object-cover bg-neutral-100 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-neutral-100 flex items-center justify-center text-2xl shrink-0" aria-hidden="true">
                        📦
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-neutral-900 text-sm">{listing.name}</h3>
                        <Badge color="gray" size="sm">{listing.category}</Badge>
                      </div>
                      <p className="text-sm font-bold text-green-700 mt-1">
                        {listing.price != null
                          ? `Rs. ${listing.price.toLocaleString()}${listing.unit ? ` / ${listing.unit}` : ""}`
                          : "—"}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {listing.supplier_name || "—"}
                        {listing.supplier_district ? ` · 📍 ${listing.supplier_district}` : ""}
                      </p>
                    </div>
                    {listing.distance_km != null && (
                      <p className="text-xs text-neutral-400 shrink-0">{listing.distance_km} km</p>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </Tabs>

      <SupplyListingDetailModal
        isOpen={selectedId !== null}
        listingId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
