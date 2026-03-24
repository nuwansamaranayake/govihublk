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

const MOCK_PRODUCTS: SupplierProduct[] = [
  { id:"1", name:"Organic NPK Fertilizer 50kg", supplier:"Agri Lanka Supplies", category:"fertilizer", description:"High-quality organic fertilizer suitable for all vegetables and paddy.", price:2500, unit:"bag", coverageArea:"All Island", availability:"In Stock", rating:4.5, verified:true },
  { id:"2", name:"Tomato Hybrid Seeds F1", supplier:"Golden Seeds Ltd", category:"seeds", description:"High-yield, disease-resistant tomato seeds. 500 seeds per pack.", price:350, unit:"pack", coverageArea:"All Island", availability:"In Stock", rating:4.2, verified:true },
  { id:"3", name:"Backpack Sprayer 15L", supplier:"FarmTech Equipment", category:"equipment", description:"Durable manual sprayer for pesticide application.", price:4500, unit:"unit", coverageArea:"Central & North Central", availability:"Limited Stock", rating:4.7, verified:true },
  { id:"4", name:"Glyphosate Herbicide 1L", supplier:"PestGuard Solutions", category:"pesticide", description:"Broad-spectrum herbicide for weed control in paddy fields.", price:850, unit:"liter", coverageArea:"Southern Province", availability:"In Stock", rating:3.9, verified:false },
  { id:"5", name:"Drip Irrigation Kit (1 acre)", supplier:"IrriSystems Lanka", category:"irrigation", description:"Complete drip irrigation system for small-scale farming.", price:18500, unit:"set", coverageArea:"All Island", availability:"Pre-order", rating:4.3, verified:true },
  { id:"6", name:"Paddy Seeds BG 352", supplier:"CIC Seeds", category:"seeds", description:"Government-recommended paddy variety for dry zone cultivation.", price:280, unit:"kg", coverageArea:"North Central Province", availability:"In Stock", rating:4.6, verified:true },
  { id:"7", name:"Tractor Hiring - Land Prep", supplier:"MechaFarm Services", category:"equipment", description:"Tractor service for land preparation, ploughing and levelling.", price:3500, unit:"hour", coverageArea:"Anuradhapura District", availability:"Available", rating:4.1, verified:false },
  { id:"8", name:"Lorry Transport 5-Ton", supplier:"AgriHaul Lanka", category:"transport", description:"Refrigerated lorry service for perishable crop transport.", price:12000, unit:"trip", coverageArea:"All Island", availability:"Available", rating:4.4, verified:true },
];

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key:"all", label:"All", icon:"🏪" },
  { key:"fertilizer", label:"Fertilizer", icon:"🌿" },
  { key:"seeds", label:"Seeds", icon:"🌱" },
  { key:"pesticide", label:"Pesticide", icon:"🧪" },
  { key:"equipment", label:"Equipment", icon:"🚜" },
  { key:"transport", label:"Transport", icon:"🚛" },
  { key:"irrigation", label:"Irrigation", icon:"💧" },
];

const CATEGORY_ICON: Record<string, string> = {
  fertilizer:"🌿", seeds:"🌱", pesticide:"🧪", equipment:"🚜", transport:"🚛", irrigation:"💧",
};

export default function BuyerMarketplacePage() {
  const t = useTranslations();
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");

  useEffect(() => {
    api.get<SupplierProduct[]>("/marketplace/supplier-products")
      .then(setProducts)
      .catch(() => setProducts(MOCK_PRODUCTS))
      .finally(() => setLoading(false));
  }, []);

  const filtered = products
    .filter(p => category==="all" || p.category===category)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.supplier.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => b.rating - a.rating);

  const tabs = CATEGORIES.map(c => ({
    key: c.key,
    label: c.label,
    badge: c.key==="all" ? products.length : products.filter(p=>p.category===c.key).length,
  }));

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-amber-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("nav.marketplace")}</h1>
        <p className="text-amber-200 text-sm mt-1">Browse supplier products and services</p>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b border-neutral-200">
        <Input
          placeholder="Search products, suppliers..."
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
              <EmptyState icon="🏪" title="No products found" description="Try a different category or search term." />
            ) : (
              filtered.map(product => (
                <Card key={product.id} padding="md">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base" aria-hidden="true">{CATEGORY_ICON[product.category]}</span>
                        <h3 className="font-semibold text-neutral-900 text-sm">{product.name}</h3>
                        {product.verified && (
                          <Badge color="green" size="sm">✓ Verified</Badge>
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
