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

type Category = "fertilizer"|"seeds"|"pesticide"|"equipment"|"irrigation"|"other";

interface Listing {
  id: string;
  title: string;
  category: Category;
  description: string;
  price: number;
  unit: string;
  coverageArea: string;
  availability: string;
  active: boolean;
  views: number;
}

const CATEGORIES: Category[] = ["fertilizer","seeds","pesticide","equipment","irrigation","other"];
const UNITS = ["kg","bag","pack","unit","liter","set","roll"];

const CATEGORY_ICON: Record<Category, string> = {
  fertilizer:"🌿", seeds:"🌱", pesticide:"🧪", equipment:"🚜", irrigation:"💧", other:"📦",
};


const EMPTY_FORM = { title:"", category:"fertilizer" as Category, description:"", price:"", unit:"kg", coverageArea:"", availability:"In Stock", active:true };
type FormData = typeof EMPTY_FORM;

export default function SupplierListingsPage() {
  const t = useTranslations();
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
    api.get<any>("/marketplace/search")
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

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (l: Listing) => {
    setEditId(l.id);
    setForm({ title:l.title, category:l.category, description:l.description, price:String(l.price), unit:l.unit, coverageArea:l.coverageArea, availability:l.availability, active:l.active });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) await api.put(`/marketplace/listings/${editId}`, form);
      else await api.post("/marketplace/listings", form);
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
                          <span className="text-base" aria-hidden="true">{CATEGORY_ICON[listing.category]}</span>
                          <h3 className="font-semibold text-neutral-900 text-sm">{listing.title}</h3>
                          <Badge color={listing.active?"green":"gray"} size="sm" dot>{listing.active ? t("common.active").toLowerCase() : t("common.inactive").toLowerCase()}</Badge>
                        </div>
                        <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{listing.description}</p>
                        <p className="text-sm text-neutral-600 mt-1">Rs. {listing.price.toLocaleString()}/{listing.unit}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-neutral-400">📍 {listing.coverageArea}</p>
                          <p className="text-xs text-neutral-400">👁 {listing.views} {t("common.views")}</p>
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
          <Select label={t("supplier.category")} required value={form.category} onChange={e => f("category", e.target.value as Category)}
            options={CATEGORIES.map(c => ({value:c, label: `${CATEGORY_ICON[c]} ${c.charAt(0).toUpperCase()+c.slice(1)}`}))} />
          <Input label={t("supplier.title")} required value={form.title} onChange={e => f("title", e.target.value)} placeholder="e.g. Organic NPK Fertilizer 50kg" />
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">{t("supplier.description")}</label>
            <textarea value={form.description} onChange={e => f("description", e.target.value)} rows={3}
              className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={t("common.describeProduct")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("supplier.priceRs")} type="number" required min="1" value={form.price}
              onChange={e => f("price", e.target.value)} placeholder="e.g. 2500" />
            <Select label={t("supplier.unit")} value={form.unit} onChange={e => f("unit", e.target.value)}
              options={UNITS.map(u => ({value:u,label:u}))} />
          </div>
          <Input label={t("supplier.coverageArea")} value={form.coverageArea} onChange={e => f("coverageArea", e.target.value)}
            placeholder="e.g. Southern Province, All Island" />
          <Select label={t("supplier.availability")} value={form.availability} onChange={e => f("availability", e.target.value)}
            options={["In Stock","Limited Stock","Pre-order","Out of Stock"].map(s => ({value:s,label:s}))} />
          <label className="flex items-center gap-3 cursor-pointer">
            <div role="switch" aria-checked={form.active} onClick={() => f("active", !form.active)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.active?"bg-blue-500":"bg-neutral-300"}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active?"translate-x-5":"translate-x-0"}`} />
            </div>
            <span className="text-sm font-medium text-neutral-700">{t("supplier.activeListing")}</span>
          </label>
          <div>
            <p className="text-sm font-medium text-neutral-700 mb-1.5">{t("supplier.photos")}</p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-xl p-6 cursor-pointer hover:border-blue-400 transition-colors">
              <span className="text-3xl mb-2" aria-hidden="true">📸</span>
              <span className="text-sm text-neutral-500">{t("common.tapToAddPhotos")}</span>
              <input type="file" accept="image/*" multiple className="sr-only" />
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
