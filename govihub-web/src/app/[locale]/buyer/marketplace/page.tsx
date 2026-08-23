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

type Category = "all"|"fertilizer"|"seeds"|"pesticide"|"equipment"|"transport"|"irrigation";

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
  { key:"transport", labelKey:"marketplace.catTransport", icon:"🚛" },
  { key:"irrigation", labelKey:"marketplace.catIrrigation", icon:"💧" },
];

const CATEGORY_ICON: Record<string, string> = {
  fertilizer:"🌿", seeds:"🌱", pesticide:"🧪", equipment:"🚜", transport:"🚛", irrigation:"💧",
};

export default function BuyerMarketplacePage() {
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

  const filtered = listings
    .filter(p => category==="all" || p.category===category)
    .filter(p =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.supplier_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));

  const tabs = CATEGORY_KEYS.map(c => ({
    key: c.key,
    label: t(c.labelKey),
    badge: c.key==="all" ? listings.length : listings.filter(p=>p.category===c.key).length,
  }));

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-amber-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("nav.marketplace")}</h1>
        <p className="text-amber-200 text-sm mt-1">{t("marketplace.browseProducts")}</p>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b border-neutral-200">
        <Input
          placeholder={t("marketplace.searchProducts")}
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
              <EmptyState icon="🏪" title={t("marketplace.noProductsFound")} description={t("marketplace.tryDifferent")} />
            ) : (
              filtered.map(product => (
                <Card key={product.id} padding="md" onClick={() => setSelectedId(product.id)}>
                  <div className="flex items-start gap-3">
                    {product.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.thumbnail}
                        alt=""
                        loading="lazy"
                        className="w-16 h-16 rounded-lg object-cover bg-neutral-100 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-neutral-100 flex items-center justify-center text-2xl shrink-0" aria-hidden="true">
                        {CATEGORY_ICON[product.category] || "📦"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-neutral-900 text-sm">{product.name}</h3>
                        <Badge color="gray" size="sm">{product.category}</Badge>
                      </div>
                      <p className="text-sm font-bold text-green-700 mt-1">
                        {product.price != null
                          ? `Rs. ${product.price.toLocaleString()}${product.unit ? ` / ${product.unit}` : ""}`
                          : "—"}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {product.supplier_name || "—"}
                        {product.supplier_district ? ` · 📍 ${product.supplier_district}` : ""}
                      </p>
                    </div>
                    {product.distance_km != null && (
                      <p className="text-xs text-neutral-400 shrink-0">{product.distance_km} km</p>
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
