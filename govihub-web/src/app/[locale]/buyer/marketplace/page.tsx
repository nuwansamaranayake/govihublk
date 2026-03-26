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
import { useAuth } from "@/lib/auth";

type Category = "all"|"fertilizer"|"seeds"|"pesticide"|"equipment"|"transport"|"irrigation";

interface SupplierProduct {
  id: string;
  name: string;
  supplier: string;
  category: Exclude<Category,"all">;
  description: string;
  price: number;
  unit: string;
  coverageArea: string;
  availability: string;
  rating: number;
  verified: boolean;
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
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");

  useEffect(() => {
    if (!isReady) return;
    api.get<any>("/marketplace/search")
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.results ?? res?.data ?? [];
        setProducts(items);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load marketplace");
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [isReady]);

  const filtered = products
    .filter(p => category==="all" || p.category===category)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.supplier.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => b.rating - a.rating);

  const tabs = CATEGORY_KEYS.map(c => ({
    key: c.key,
    label: t(c.labelKey),
    badge: c.key==="all" ? products.length : products.filter(p=>p.category===c.key).length,
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
                <Card key={product.id} padding="md">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base" aria-hidden="true">{CATEGORY_ICON[product.category]}</span>
                        <h3 className="font-semibold text-neutral-900 text-sm">{product.name}</h3>
                        {product.verified && (
                          <Badge color="green" size="sm">✓ {t("marketplace.verified")}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{product.description}</p>
                      <p className="text-xs text-neutral-400 mt-1">by {product.supplier}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-green-700">Rs. {product.price.toLocaleString()}</p>
                      <p className="text-xs text-neutral-400">per {product.unit}</p>
                      <p className="text-sm font-medium text-amber-500 mt-1">★ {product.rating}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                    <p className="text-xs text-neutral-500">📍 {product.coverageArea}</p>
                    <Badge color={product.availability === "In Stock" ? "green" : product.availability === "Limited Stock" ? "gold" : "gray"} size="sm">
                      {product.availability}
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </Tabs>
    </div>
  );
}
