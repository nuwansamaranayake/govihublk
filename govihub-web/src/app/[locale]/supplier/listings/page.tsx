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
  // Listing photos as exposed by the API (`photos`: string[], `thumbnail`).
  photos?: string[] | null;
  thumbnail?: string | null;
  created_at?: string;
}

const CATEGORIES: Category[] = ["fertilizer","seeds","pesticide","equipment","irrigation","other"];
const UNITS = ["kg","bag","pack","unit","liter","set","roll"];

const CATEGORY_ICON: Record<Category, string> = {
  fertilizer:"🌿", seeds:"🌱", pesticide:"🧪", equipment:"🚜", irrigation:"💧", other:"📦",
};


const EMPTY_FORM = { name:"", category:"fertilizer" as Category, description:"", price:"", unit:"kg", stock_quantity:"", delivery_available:false };
type FormData = typeof EMPTY_FORM;

interface PendingPhoto {
  file: File;
  preview: string;
}

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
  // Page-level banner for photo-upload failure after the listing was saved.
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  // Photos already on the listing (edit mode) — server URLs.
  const [photos, setPhotos] = useState<string[]>([]);
  // Photos staged locally before the listing exists (create mode).
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const MAX_PHOTOS = 3;
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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

  const clearPending = () => {
    setPending(prev => {
      prev.forEach(p => URL.revokeObjectURL(p.preview));
      return [];
    });
  };

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setPhotos([]);
    clearPending();
    setError(null);
    setPhotoUploadError(null);
    setShowModal(true);
  };
  const openEdit = (l: Listing) => {
    setEditId(l.id);
    setForm({ name:l.name||"", category:l.category, description:l.description||"", price:String(l.price||""), unit:l.unit||"kg", stock_quantity:String(l.stock_quantity||""), delivery_available:l.delivery_available||false });
    // Hydrate existing photos from the listing's `photos` array (string[]).
    const raw = Array.isArray(l.photos) ? l.photos : [];
    setPhotos(raw.filter((u): u is string => typeof u === "string" && u.length > 0));
    clearPending();
    setError(null);
    setPhotoUploadError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    clearPending();
    setShowModal(false);
  };

  const photoCount = photos.length + pending.length;

  const uploadFiles = async (listingId: string, files: File[]): Promise<string[]> => {
    const fd = new FormData();
    files.forEach(f => fd.append("files", f));
    const res = await api.upload<{ photos: string[] }>(
      `/marketplace/listings/${listingId}/images`,
      fd,
    );
    return res?.photos ?? [];
  };

  const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";  // allow re-selecting the same file later
    if (files.length === 0) return;
    if (photoCount + files.length > MAX_PHOTOS) {
      setError(t("marketplace.photo_rules"));
      return;
    }
    if (files.some(f => f.size > MAX_PHOTO_BYTES)) {
      setError(t("marketplace.photo_rules"));
      return;
    }
    setError(null);
    if (editId) {
      // Listing exists — upload immediately via the listing images endpoint.
      setUploadingPhotos(true);
      try {
        const updated = await uploadFiles(editId, files);
        setPhotos(updated);
      } catch (err: any) {
        setError(
          err?.code === "LISTING_PHOTO_LIMIT"
            ? t("marketplace.photo_rules")
            : err?.message || t("marketplace.photo_upload_failed")
        );
      } finally {
        setUploadingPhotos(false);
      }
    } else {
      // No listing yet — stage locally, upload after create.
      setPending(prev => [
        ...prev,
        ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) })),
      ]);
    }
  };

  const removePendingPhoto = (preview: string) => {
    setPending(prev => {
      const target = prev.find(p => p.preview === preview);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter(p => p.preview !== preview);
    });
  };

  const removeServerPhoto = async (url: string) => {
    if (!editId) return;
    try {
      const res = await api.delete<{ photos: string[] }>(
        `/marketplace/listings/${editId}/images`,
        { url },
      );
      setPhotos(res?.photos ?? []);
    } catch (err: any) {
      setError(err?.message || t("marketplace.photo_upload_failed"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setPhotoUploadError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v !== "" && v !== undefined) payload[k] = v;
      }
      // delivery_radius_km required when delivery_available is true
      if (payload.delivery_available && !payload.delivery_radius_km) {
        payload.delivery_radius_km = 50; // default 50km radius
      }
      if (editId) {
        await api.put(`/marketplace/listings/${editId}`, payload);
      } else {
        const created = await api.post<{ id: string }>("/marketplace/listings", payload);
        // Listing saved — now upload any staged photos to the images endpoint.
        if (pending.length > 0 && created?.id) {
          try {
            await uploadFiles(created.id, pending.map(p => p.file));
          } catch {
            // Listing is saved; surface the photo failure, never drop it silently.
            setPhotoUploadError(t("marketplace.photo_upload_failed"));
          }
        }
      }
      clearPending();
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

      {photoUploadError && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2 flex items-start justify-between gap-2">
          <span>{photoUploadError}</span>
          <button type="button" onClick={() => setPhotoUploadError(null)} aria-label="Dismiss" className="shrink-0 font-bold">✕</button>
        </div>
      )}

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
                      {listing.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={listing.thumbnail}
                          alt=""
                          loading="lazy"
                          className="w-14 h-14 rounded-lg object-cover bg-neutral-100 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center text-2xl shrink-0" aria-hidden="true">
                          {CATEGORY_ICON[listing.category] || "📦"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
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

      <Modal isOpen={showModal} onClose={closeModal}
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

          <div>
            <p className="text-sm font-medium text-neutral-700 mb-1.5">{t("marketplace.listing_photos")}</p>

            {/* Thumbnails: server photos (edit) + staged photos (create) */}
            {photoCount > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {photos.map((url) => (
                  <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeServerPhoto(url)}
                      aria-label="Remove photo"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {pending.map((p) => (
                  <div key={p.preview} className="relative aspect-square rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePendingPhoto(p.preview)}
                      aria-label="Remove photo"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload zone (hidden once we've hit the cap so the cap is visually clear) */}
            {photoCount < MAX_PHOTOS && (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-xl p-6 cursor-pointer hover:border-blue-400 transition-colors">
                <span className="text-3xl mb-2" aria-hidden="true">📸</span>
                <span className="text-sm text-neutral-500">
                  {uploadingPhotos ? "Uploading..." : t("marketplace.add_photos")}
                </span>
                <span className="text-xs text-neutral-400 mt-1">
                  {photoCount}/{MAX_PHOTOS} • {t("marketplace.photo_rules")}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  disabled={uploadingPhotos}
                  onChange={handlePhotoSelect}
                />
              </label>
            )}
          </div>

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
