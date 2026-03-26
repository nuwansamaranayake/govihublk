"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { formatStatus, cropName } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

interface Listing {
  id: string;
  crop: any; // object: {id, name_en, name_si, category}
  crop_id: number;
  variety: string;
  quantity_kg: number;
  price_per_kg: number;
  min_price_per_kg: number;
  available_from: string;
  available_until: string;
  harvest_date: string;
  description: string;
  quality_grade: string;
  is_organic: boolean;
  delivery_available: boolean;
  delivery_radius_km: number;
  latitude: number;
  longitude: number;
  images: any[];
  farmer_id: string;
  status: "planned" | "ready" | "fulfilled" | "cancelled" | "expired";
  created_at: string;
  updated_at: string;
}

const CROPS = [
  "Tomato","Cabbage","Carrot","Beans","Potato","Onion",
  "Chilli","Brinjal","Cucumber","Pumpkin","Leek","Radish",
  "Lettuce","Spinach","Peas","Corn","Ginger","Garlic",
];


const EMPTY_FORM = { crop_id:"", variety:"", quantity_kg:"", price_per_kg:"", min_price_per_kg:"", available_from:"", available_until:"", description:"", quality_grade:"A", is_organic:false, delivery_available:false };
type FormData = typeof EMPTY_FORM;

const STATUS_COLOR: Record<string, "green"|"gray"|"gold"|"blue"> = { planned:"blue", ready:"green", fulfilled:"gray", cancelled:"gray", expired:"gray" };

export default function FarmerListingsPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
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
    api.get<any>("/listings/harvest")
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        setListings(items);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load listings");
        setListings([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isReady) load(); }, [isReady]);

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (l: Listing) => {
    setEditId(l.id);
    setForm({ crop_id:String(l.crop_id || ''), variety:l.variety || '', quantity_kg:String(l.quantity_kg), price_per_kg:String(l.price_per_kg), min_price_per_kg:String(l.min_price_per_kg || ''), available_from:l.available_from?.split('T')[0] || '', available_until:l.available_until?.split('T')[0] || '', description:l.description || '', quality_grade:l.quality_grade || 'A', is_organic:l.is_organic || false, delivery_available:l.delivery_available || false });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) {
        await api.put(`/listings/harvest/${editId}`, form);
      } else {
        await api.post("/listings/harvest", form);
      }
      setShowModal(false);
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to save listing");
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("common.deleteConfirmListing"))) return;
    try {
      await api.delete(`/listings/harvest/${id}`);
      setListings(prev => prev.filter(l => l.id !== id));
    } catch (err: any) {
      setError(err?.message || "Failed to delete listing");
    }
  };

  const f = (key: keyof FormData, val: string) => setForm(p => ({...p, [key]: val}));

  const tabs = [
    { key:"all", label: t("common.all"), badge: listings.length },
    { key:"planned", label: t("status.planned"), badge: listings.filter(l=>l.status==="planned").length },
    { key:"ready", label: t("status.ready"), badge: listings.filter(l=>l.status==="ready").length },
    { key:"fulfilled", label: t("status.fulfilled") },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-green-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("farmer.myListings")}</h1>
        <p className="text-green-200 text-sm mt-1">{listings.length} {t("listing.totalListings")}</p>
      </div>

      <Tabs tabs={tabs} defaultTab="all">
        {(activeTab) => {
          const filtered = activeTab === "all" ? listings : listings.filter(l => l.status === activeTab);
          return (
            <div className="px-4 py-4 pb-20 space-y-3">
              {loading ? (
                Array.from({length:3}).map((_,i) => (
                  <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                    <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/3" />
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon="🌾"
                  title={t("common.noListings")}
                  description={t("common.addFirstListing")}
                  action={{ label: t("farmer.addListing"), onClick: openCreate }}
                />
              ) : (
                filtered.map(listing => (
                  <Card key={listing.id} padding="md">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-neutral-900">{cropName(listing.crop, locale)}</h3>
                          <Badge color={STATUS_COLOR[listing.status]||"gray"} size="sm" dot>{formatStatus(listing.status)}</Badge>
                        </div>
                        <p className="text-sm text-neutral-600 mt-1">{listing.quantity_kg} kg · Rs. {listing.price_per_kg}/kg</p>
                        <p className="text-xs text-neutral-400 mt-1">{listing.variety && `${listing.variety} · `}🗓 {listing.available_from ? new Date(listing.available_from).toLocaleDateString() : ''}</p>
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
      <button
        onClick={openCreate}
        className="fixed bottom-20 right-4 w-14 h-14 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-green-700 active:scale-95 transition-transform z-10"
        aria-label={t("farmer.addListing")}
      >+</button>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? t("farmer.editListing") : t("farmer.newHarvestListing")}
        size="lg"
        footer={
          <Button variant="primary" fullWidth loading={submitting}
            onClick={() => (document.getElementById("listing-form") as HTMLFormElement)?.requestSubmit()}>
            {editId ? t("farmer.updateListing") : t("farmer.createListing")}
          </Button>
        }
      >
        <form id="listing-form" onSubmit={handleSubmit} className="space-y-4">
          <Select label={t("farmer.cropName")} required value={form.crop_id} onChange={e => f("crop_id", e.target.value)}
            placeholder={t("listing.selectCrop")} options={CROPS.map((c, i) => ({value:String(i+1), label:c}))} />
          <Input label={t("farmer.variety")} value={form.variety}
            onChange={e => f("variety", e.target.value)} placeholder="e.g. Big Beef" />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("farmer.quantity") + " (kg)"} type="number" required min="1" value={form.quantity_kg}
              onChange={e => f("quantity_kg", e.target.value)} placeholder="e.g. 500" />
            <Select label={t("farmer.qualityGrade")} value={form.quality_grade} onChange={e => f("quality_grade", e.target.value)}
              options={["A","B","C"].map(g => ({value:g, label:`Grade ${g}`}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("farmer.price") + " (Rs/kg)"} type="number" required min="1" value={form.price_per_kg}
              onChange={e => f("price_per_kg", e.target.value)} placeholder="e.g. 120" />
            <Input label={t("farmer.minPrice") + " (Rs/kg)"} type="number" value={form.min_price_per_kg}
              onChange={e => f("min_price_per_kg", e.target.value)} placeholder="e.g. 100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("farmer.availableFrom")} type="date" required value={form.available_from}
              onChange={e => f("available_from", e.target.value)} />
            <Input label={t("farmer.availableUntil")} type="date" value={form.available_until}
              onChange={e => f("available_until", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">{t("farmer.description")}</label>
            <textarea value={form.description} onChange={e => f("description", e.target.value)} rows={3}
              className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              placeholder={t("common.additionalDetails")} />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-700 mb-1.5">{t("farmer.photos")}</p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-xl p-6 cursor-pointer hover:border-green-400 transition-colors">
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
