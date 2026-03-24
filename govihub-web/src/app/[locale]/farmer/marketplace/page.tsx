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

type Category = "all"|"fertilizer"|"seeds"|"pesticide"|"equipment"|"irrigation";

interface Supplier {
  id: string;
  name: string;
  category: Exclude<Category,"all">;
  description: string;
  location: string;
  distance: number;
  rating: number;
  phone: string;
  verified: boolean;
}

const MOCK_SUPPLIERS: Supplier[] = [
  { id:"1", name:"Agri Lanka Supplies", category:"fertilizer", description:"Quality organic and chemical fertilizers for all crops.", location:"Kandy", distance:3.2, rating:4.5, phone:"+94 77 123 4567", verified:true },
  { id:"2", name:"Golden Seeds Ltd", category:"seeds", description:"Certified hybrid and open-pollinated vegetable seeds.", location:"Peradeniya", distance:5.1, rating:4.2, phone:"+94 81 234 5678", verified:true },
  { id:"3", name:"PestGuard Solutions", category:"pesticide", description:"EPA-approved crop protection products.", location:"Matale", distance:12.4, rating:3.9, phone:"+94 66 345 6789", verified:false },
  { id:"4", name:"FarmTech Equipment", category:"equipment", description:"Tractors, tillers, sprayers and farm tools.", location:"Kurunegala", distance:28.7, rating:4.7, phone:"+94 37 456 7890", verified:true },
  { id:"5", name:"IrriSystems Lanka", category:"irrigation", description:"Drip and sprinkler irrigation systems.", location:"Dambulla", distance:35.0, rating:4.3, phone:"+94 66 567 8901", verified:true },
];

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key:"all", label:"All", icon:"🏪" },
  { key:"fertilizer", label:"Fertilizer", icon:"🌿" },
  { key:"seeds", label:"Seeds", icon:"🌱" },
  { key:"pesticide", label:"Pesticide", icon:"🧪" },
  { key:"equipment", label:"Equipment", icon:"🚜" },
  { key:"irrigation", label:"Irrigation", icon:"💧" },
];

export default function FarmerMarketplacePage() {
  const t = useTranslations();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("all");

  useEffect(() => {
    api.get<Supplier[]>("/marketplace/suppliers")
      .then(setSuppliers)
      .catch(() => setSuppliers(MOCK_SUPPLIERS))
      .finally(() => setLoading(false));
  }, []);

  const filtered = suppliers
    .filter(s => category==="all" || s.category===category)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => a.distance - b.distance);

  const tabs = CATEGORIES.map(c => ({
    key: c.key,
    label: c.label,
    badge: c.key==="all" ? suppliers.length : suppliers.filter(s=>s.category===c.key).length,
  }));

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-green-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("nav.marketplace")}</h1>
        <p className="text-green-200 text-sm mt-1">Find suppliers near you</p>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b border-neutral-200">
        <Input
          placeholder="Search suppliers..."
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
              <EmptyState icon="🏪" title="No suppliers found" description="Try a different category or search term." />
            ) : (
              filtered.map(supplier => (
                <Card key={supplier.id} padding="md">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-neutral-900 text-sm">{supplier.name}</h3>
                        {supplier.verified && (
                          <Badge color="green" size="sm">✓ Verified</Badge>
                        )}
                        <Badge color="gray" size="sm">{supplier.category}</Badge>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">{supplier.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-amber-500">★ {supplier.rating}</p>
                      <p className="text-xs text-neutral-400">{supplier.distance} km</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                    <p className="text-xs text-neutral-500">📍 {supplier.location}</p>
                    <a
                      href={`tel:${supplier.phone}`}
                      className="text-sm font-medium text-green-600 hover:text-green-700"
                    >
                      📞 {supplier.phone}
                    </a>
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
