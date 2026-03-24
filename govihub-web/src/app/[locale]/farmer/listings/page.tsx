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

interface Listing {
  id: string;
  crop: string;
  quantity: number;
  unit: string;
  price: number;
  location: string;
  harvestDate: string;
  status: "planned" | "ready" | "fulfilled" | "cancelled" | "expired";
}

const CROPS = [
  "Tomato","Cabbage","Carrot","Beans","Potato","Onion",
  "Chilli","Brinjal","Cucumber","Pumpkin","Leek","Radish",
  "Lettuce","Spinach","Peas","Corn","Ginger","Garlic",
];
const UNITS = ["kg","ton","crate","bunch","bag"];

const MOCK: Listing[] = [
  { id:"1", crop:"Tomato", quantity:500, unit:"kg", price:120, location:"Kandy", harvestDate:"2026-04-10", status:"ready" },
  { id:"2", crop:"Cabbage", quantity:300, unit:"kg", price:85, location:"Nuwara Eliya", harvestDate:"2026-04-15", status:"planned" },
  { id:"3", crop:"Carrot", quantity:200, unit:"kg", price:155, location:"Badulla", harvestDate:"2026-03-20", status:"fulfilled" },
];

const EMPTY_FORM = { crop:"", quantity:"", unit:"kg", price:"", location:"", harvestDate:"", expiryDate:"", description:"" };
type FormData = typeof EMPTY_FORM;

const STATUS_COLOR: Record<string, "green"|"gray"|"gold"|"blue"> = { planned:"blue", ready:"green", fulfilled:"gray", cancelled:"gray", expired:"gray" };

export default function FarmerListingsPage() {
  const t = useTranslations();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    api.get<Listing[]>("/api/v1/farmer/listings")
      .then(setListings)
      .catch(() => setListings(MOCK))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (l: Listing) => {
    setEditId(l.id);
    setForm({ crop:l.crop, quantity:String(l.quantity), unit:l.unit, price:String(l.price), location:l.location, harvestDate:l.harvestDate, expiryDate:"", description:"" });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) {
        await api.put(`/api/v1/farmer/listings/${editId}`, form);
      } else {
        await api.post("/api/v1/farmer/listings", form);
      }
      setShowModal(false);
      await load();
    } catch {
      const item: Listing = { id: editId || String(Date.now()), crop:form.crop, quantity:Number(form.quantity), unit:form.unit, price:Number(form.price), location:form.location, harvestDate:form.harvestDate, status:"planned" };
      setListings(prev => editId ? prev.map(l => l.id===editId ? item : l) : [...prev, item]);
      setShowModal(false);
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    await api.delete(`/api/v1/farmer/listings/${id}`).catch(()=>{});
    setListings(prev => prev.filter(l => l.id !== id));
  };

  const f = (key: keyof FormData, val: string) => setForm(p => ({...p, [key]: val}));

  const tabs = [
    { key:"all", label:"All", badge: listings.length },
    { key:"planned", label:"Planned", badge: listings.filter(l=>l.status==="planned").length },
    { key:"ready", label:"Ready", badge: listings.filter(l=>l.status==="ready").length },
    { key:"fulfilled", label:"Fulfilled" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-green-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("farmer.myListings")}</h1>
        <p className="text-green-200 text-sm mt-1">{listings.length} total listings</p>
      </div>

      <Tabs tabs={tabs} defaultTab="all">
        {(activeTab) => {
          const filtered = activeTab === "all" ? listings : listings.filter(l => l.status === activeTab);
          return (
            <div className="px-4 py-4 space-y-3">
              {loading ? (
                Array.from({length:3}).map((_,i) => (
                  <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                    <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/3" />
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon="🌾"
                  title="No listings here"
                  description="Add your first harvest listing to connect with buyers."
                  action={{ label: t("farmer.addListing"), onClick: openCreate }}
                />
              ) : (
                filtered.map(listing => (
                  <Card key={listing.id} padding="md">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-neutral-900">{listing.crop}</h3>
                          <Badge color={STATUS_COLOR[listing.status]||"gray"} size="sm" dot>{listing.status}</Badge>
                        </div>
                        <p className="text-sm text-neutral-600 mt-1">{listing.quantity} {listing.unit} · Rs. {listing.price}/{listing.unit}</p>
                        <p className="text-xs text-neutral-400 mt-1">📍 {listing.location} · 🗓 {listing.harvestDate}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(listing)}>Edit</Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(listing.id)}>Delete</Button>
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
        aria-label="Add Listing"
      >+</button>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editId ? "Edit Listing" : "New Harvest Listing"}
        size="lg"
        footer={
          <Button variant="primary" fullWidth loading={submitting}
            onClick={() => (document.getElementById("listing-form") as HTMLFormElement)?.requestSubmit()}>
            {editId ? "Update Listing" : "Create Listing"}
          </Button>
        }
      >
        <form id="listing-form" onSubmit={handleSubmit} className="space-y-4">
          <Select label="Crop" required value={form.crop} onChange={e => f("crop", e.target.value)}
            placeholder="Select a crop" options={CROPS.map(c => ({value:c, label:c}))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantity" type="number" required min="1" value={form.quantity}
              onChange={e => f("quantity", e.target.value)} placeholder="e.g. 500" />
            <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)}
              options={UNITS.map(u => ({value:u, label:u}))} />
          </div>
          <Input label="Price (Rs. per unit)" type="number" required min="1" value={form.price}
            onChange={e => f("price", e.target.value)} placeholder="e.g. 120" />
          <Input label="Location" required value={form.location}
            onChange={e => f("location", e.target.value)} placeholder="e.g. Kandy" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Harvest Date" type="date" required value={form.harvestDate}
              onChange={e => f("harvestDate", e.target.value)} />
            <Input label="Expiry Date" type="date" value={form.expiryDate}
              onChange={e => f("expiryDate", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => f("description", e.target.value)} rows={3}
              className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              placeholder="Additional details about your harvest..." />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-700 mb-1.5">Photos (optional)</p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-xl p-6 cursor-pointer hover:border-green-400 transition-colors">
              <span className="text-3xl mb-2" aria-hidden="true">📸</span>
              <span className="text-sm text-neutral-500">Tap to add photos</span>
              <input type="file" accept="image/*" multiple className="sr-only" />
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
