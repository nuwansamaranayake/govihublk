"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth } from "@/lib/auth";

type Category = "fertilizer"|"seeds"|"pesticide"|"equipment"|"irrigation"|"other";

interface Listing {
  id: string;
  name: string;
  category: Category;
  description: string;
  price: number;
  unit: string;
  status: string;
  delivery_available: boolean;
  delivery_radius_km?: number;
  stock_quantity?: number;
  created_at?: string;
}

const CATEGORIES: Category[] = ["fertilizer","seeds","pesticide","equipment","irrigation","other"];
const UNITS = ["kg","bag","pack","unit","liter","set","roll"];

const CATEGORY_ICON: Record<Category, string> = {
  fertilizer:"🌿", seeds:"🌱", pesticide:"🧪", equipment:"🚜", irrigation:"💧", other:"📦",
};


const EMPTY_FORM = { name:"", category:"fertilizer" as Category, description:"", price:"", unit:"kg", stock_quantity:"", delivery_available:false };
type FormData = typeof EMPTY_FORM;

export default function SupplierListingsPage() {
  const t = useTranslations();
  const { isReady } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get<any>("/marketplace/listings/mine")
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.results ?? res?.data ?? [];
        setListings(items);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load listings");
        setListings([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isReady) load(); }, [isReady]);

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setError(null); setShowModal(true); };
  const openEdit = (l: Listing) => {
    setEditId(l.id);
    setForm({ name:l.name||"", category:l.category, description:l.description||"", price:String(l.price||""), unit:l.unit||"kg", stock_quantity:String(l.stock_quantity||""), delivery_available:l.delivery_available||false });
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v !== "" && v !== undefined) payload[k] = v;
      }
      // delivery_radius_km required when delivery_available is true
      if (payload.delivery_available && !payload.delivery_radius_km) {
        payload.delivery_radius_km = 50; // default 50km radius
      }
      if (editId) await api.put(`/marketplace/listings/${editId}`, payload);
      else await api.post("/marketplace/listings", payload);
      setShowModal(false);
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to save listing");
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("common.deleteConfirmListing"))) return;
    try {
      await api.delete(`/marketplace/listings/${id}`);
      setListings(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      setError(err?.message || "Failed to delete listing");
    }
  };

  const f = (key: keyof FormData, val: string|boolean) => setForm(p => ({...p, [key]: val}));

  const tabs = [
    { key:"all", label: t("common.all"), badge: listings.length },
    ...CATEGORIES.map(c => ({ key:c, label: c.charAt(0).toUpperCase()+c.slice(1), badge: listings.filter(l=>l.category===c).length })),
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-blue-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("supplier.myListings")}</h1>
        <p className="text-blue-100 text-sm mt-1">{listings.length} {t("listing.totalListings")}</p>
      </div>

      <Tabs tabs={tabs} defaultTab="all">
        {(activeTab) => {
          const filtered = activeTab==="all" ? listings : listings.filter(l => l.category===activeTab);
          return (
            <div className="px-4 py-4 pb-20 space-y-3">
              {loading ? (
                Array.from({length:3}).map((_,i) => (
                  <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                    <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/3" />
                  </div>
                ))
              ) : filtered.length===0 ? (
                <EmptyState icon="📦" title={t("common.noListings")} description={t("common.addSupplyListings")}
                  action={{ label: t("supplier.addListing"), onClick: openCreate }} />
              ) : (
                filtered.map(listing => (
                  <Card key={listing.id} padding="md">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base" aria-hidden="true">{CATEGORY_ICON[listing.category] || "📦"}</span>
                          <h3 className="font-semibold text-neutral-900 text-sm">{listing.name}</h3>
                          <Badge color={listing.status==="active"?"green":"gray"} size="sm" dot>{listing.status}</Badge>
                        </div>
                        <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{listing.description}</p>
                        {listing.price != null && <p className="text-sm text-neutral-600 mt-1">Rs. {listing.price.toLocaleString()}/{listing.unit || "unit"}</p>}
                        <div className="flex items-center gap-3 mt-1">
                          {listing.stock_quantity != null && <p className="text-xs text-neutral-400">Stock: {listing.stock_quantity}</p>}
                          {listing.delivery_available && <p className="text-xs text-neutral-400">🚚 Delivery available</p>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(listing)}>{t("common.edit")}</Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(listing.id)}>{t("common.delete")}</Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          );
        }}
      </Tabs>

      {/* FAB */}
      <button onClick={openCreate}
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-blue-700 active:scale-95 transition-transform z-10"
        aria-label={t("supplier.addListing")}>+</button>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editId ? t("supplier.editListing") : t("supplier.newSupplyListing")}
        size="lg"
        footer={
          <Button variant="primary" fullWidth loading={submitting}
            onClick={() => (document.getElementById("supply-form") as HTMLFormElement)?.requestSubmit()}>
            {editId ? t("supplier.updateListing") : t("supplier.createListing")}
          </Button>
        }
      >
        <form id="supply-form" onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2">{error}</div>}
          <Select label={t("supplier.category")} required value={form.category} onChange={e => f("category", e.target.value as Category)}
            options={CATEGORIES.map(c => ({value:c, label: `${CATEGORY_ICON[c]} ${c.charAt(0).toUpperCase()+c.slice(1)}`}))} />
          <Input label={t("supplier.title")} required value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. Organic NPK Fertilizer 50kg" />
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">{t("supplier.description")}</label>
            <textarea value={form.description} onChange={e => f("description", e.target.value)} rows={3}
              className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={t("common.describeProduct")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("supplier.priceRs")} type="number" min="1" value={form.price}
              onChange={e => f("price", e.target.value)} placeholder="e.g. 2500" />
            <Select label={t("supplier.unit")} value={form.unit} onChange={e => f("unit", e.target.value)}
              options={UNITS.map(u => ({value:u,label:u}))} />
          </div>
          <Input label="Stock Quantity" type="number" min="0" value={form.stock_quantity}
            onChange={e => f("stock_quantity", e.target.value)} placeholder="e.g. 100" />
          <label className="flex items-center gap-3 cursor-pointer">
            <div role="switch" aria-checked={form.delivery_available} onClick={() => f("delivery_available", !form.delivery_available)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.delivery_available?"bg-blue-500":"bg-neutral-300"}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.delivery_available?"translate-x-5":"translate-x-0"}`} />
            </div>
            <span className="text-sm font-medium text-neutral-700">Delivery Available</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
