"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type Category = "fertilizer"|"seeds"|"pesticide"|"equipment"|"irrigation"|"other";

interface ListingSummary {
  id: string;
  title: string;
  category: Category;
  price: number;
  unit: string;
  active: boolean;
  views: number;
  inquiries: number;
}

interface DashboardData {
  supplierName: string;
  totalListings: number;
  activeListings: number;
  totalViews: number;
  totalInquiries: number;
  listingsByCategory: { category: Category; count: number }[];
  recentListings: ListingSummary[];
}

const CATEGORY_ICON: Record<Category, string> = {
  fertilizer:"🌿", seeds:"🌱", pesticide:"🧪", equipment:"🚜", irrigation:"💧", other:"📦",
};

const MOCK: DashboardData = {
  supplierName: "Sunil Fernando",
  totalListings: 8,
  activeListings: 6,
  totalViews: 245,
  totalInquiries: 34,
  listingsByCategory: [
    { category:"fertilizer", count:3 },
    { category:"seeds", count:2 },
    { category:"equipment", count:2 },
    { category:"irrigation", count:1 },
  ],
  recentListings: [
    { id:"1", title:"NPK Fertilizer 50kg", category:"fertilizer", price:2500, unit:"bag", active:true, views:45, inquiries:8 },
    { id:"2", title:"Paddy Seeds (BG 352)", category:"seeds", price:350, unit:"pack", active:true, views:32, inquiries:5 },
    { id:"3", title:"Organic Compost 25kg", category:"fertilizer", price:1200, unit:"bag", active:true, views:28, inquiries:6 },
  ],
};

export default function SupplierDashboardPage() {
  const t = useTranslations();
  const [data, setData] = useState<DashboardData|null>(null);
  const [loading, setLoading] = useState(true);
  const hour = new Date().getHours();
  const greeting = hour<12 ? t("greeting.morning") : hour<17 ? t("greeting.afternoon") : t("greeting.evening");

  useEffect(() => {
    api.get<DashboardData>("/supplier/dashboard")
      .then(setData)
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-gradient-to-br from-blue-700 to-blue-500 px-4 pt-12 pb-16 text-white">
        <p className="text-blue-100 text-sm font-medium">{greeting}</p>
        {loading ? <Skeleton className="h-7 w-44 mt-1" /> : (
          <h1 className="text-2xl font-bold mt-1">{data?.supplierName ?? "Supplier"} 👋</h1>
        )}
        <p className="text-blue-100 text-sm mt-1">{t("supplier.dashboard")}</p>
      </div>

      <div className="px-4 -mt-10 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: t("farmer.totalListings"), value:data?.totalListings, color:"text-blue-600" },
            { label: t("common.active"), value:data?.activeListings, color:"text-green-600" },
            { label: t("common.totalViews"), value:data?.totalViews, color:"text-purple-600" },
            { label: t("supplier.inquiries"), value:data?.totalInquiries, color:"text-amber-500" },
          ].map(s => (
            <Card key={s.label} padding="sm" className="text-center">
              {loading ? <Skeleton className="h-8 w-12 mx-auto mb-1" /> : (
                <p className={`text-xl font-bold ${s.color}`}>{s.value ?? 0}</p>
              )}
              <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Listings by Category */}
        <Card header={<h2 className="font-semibold text-neutral-800 text-sm">{t("common.listingsByCategory")}</h2>} padding="md">
          {loading ? <Skeleton className="h-24 w-full" /> : (
            <div className="grid grid-cols-2 gap-3 mt-2">
              {data?.listingsByCategory.map(item => (
                <div key={item.category} className="flex items-center gap-2 bg-neutral-50 rounded-xl p-3">
                  <span className="text-xl" aria-hidden="true">{CATEGORY_ICON[item.category]}</span>
                  <div>
                    <p className="text-sm font-medium text-neutral-800 capitalize">{item.category}</p>
                    <p className="text-xs text-neutral-500">{item.count} {t("nav.listings").toLowerCase()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Action */}
        <a href="listings"
          className="flex items-center gap-3 bg-blue-600 text-white rounded-2xl p-4 shadow-sm hover:bg-blue-700 transition-colors">
          <span className="text-2xl" aria-hidden="true">➕</span>
          <div>
            <p className="font-semibold">{t("supplier.addListing")}</p>
            <p className="text-blue-100 text-xs">{t("common.addNewSupply")}</p>
          </div>
        </a>

        {/* Recent Listings */}
        <Card header={<h2 className="font-semibold text-neutral-800 text-sm">{t("common.recentListings")}</h2>} padding="none">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
          ) : data?.recentListings.length ? (
            <ul className="divide-y divide-neutral-50">
              {data.recentListings.map(item => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base" aria-hidden="true">{CATEGORY_ICON[item.category]}</span>
                        <span className="font-medium text-neutral-900 text-sm">{item.title}</span>
                        <Badge color={item.active?"green":"gray"} size="sm" dot>
                          {item.active ? t("common.active").toLowerCase() : t("common.inactive").toLowerCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-neutral-600 mt-0.5">Rs. {item.price.toLocaleString()}/{item.unit}</p>
                    </div>
                    <div className="text-right shrink-0 text-xs text-neutral-400">
                      <p>{item.views} {t("common.views")}</p>
                      <p>{item.inquiries} {t("supplier.inquiries").toLowerCase()}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="📦" title={t("common.noListingsYet")} description={t("common.addFirstSupplyListing")} />
          )}
        </Card>
      </div>
    </div>
  );
}
