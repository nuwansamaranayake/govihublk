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

interface Demand {
  id: string;
  crop: string;
  quantity: number;
  unit: string;
  minPrice: number;
  maxPrice: number;
  location: string;
  radius: number;
  startDate: string;
  endDate: string;
  recurring: boolean;
  status: "open"|"reviewing"|"confirmed"|"closed"|"expired";
}

const CROPS = ["Tomato","Cabbage","Carrot","Beans","Potato","Onion","Chilli","Brinjal","Cucumber","Pumpkin","Leek","Radish"];
const UNITS = ["kg","ton","crate","bunch","bag"];

const MOCK: Demand[] = [
  { id:"1", crop:"Tomato", quantity:500, unit:"kg", minPrice:100, maxPrice:130, location:"Colombo", radius:50, startDate:"2026-04-01", endDate:"2026-04-30", recurring:true, status:"open" },
  { id:"2", crop:"Cabbage", quantity:300, unit:"kg", minPrice:70, maxPrice:90, location:"Gampaha", radius:30, startDate:"2026-04-10", endDate:"2026-04-20", recurring:false, status:"reviewing" },
  { id:"3", crop:"Carrot", quantity:150, unit:"kg", minPrice:140, maxPrice:165, location:"Kandy", radius:20, startDate:"2026-03-01", endDate:"2026-03-31", recurring:false, status:"closed" },
];

const EMPTY_FORM = { crop:"", quantity:"", unit:"kg", minPrice:"", maxPrice:"", location:"", radius:"50", startDate:"", endDate:"", recurring:false };
type FormData = typeof EMPTY_FORM;

const STATUS_COLOR: Record<string,"green"|"gold"|"gray"|"red"|"blue"|"darkgreen"> = { open:"blue", reviewing:"gold", confirmed:"darkgreen", closed:"gray", expired:"gray" };

export default function BuyerDemandsPage() {
  const t = useTranslations();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    api.get<Demand[]>("/api/v1/buyer/demands")
      .then(setDemands)
      .catch(() => setDemands(MOCK))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (d: Demand) => {
    setEditId(d.id);
    setForm({ crop:d.crop, quantity:String(d.quantity), unit:d.unit, minPrice:String(d.minPrice), maxPrice:String(d.maxPrice), location:d.location, radius:String(d.radius), startDate:d.startDate, endDate:d.endDate, recurring:d.recurring });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) await api.put(`/api/v1/buyer/demands/${editId}`, form);
      else await api.post("/api/v1/buyer/demands", form);
      setShowModal(false);
      await load();
    } catch {
      const item: Demand = { id: editId||String(Date.now()), crop:form.crop, quantity:Number(form.quantity), unit:form.unit, minPrice:Number(form.minPrice), maxPrice:Number(form.maxPrice), location:form.location, radius:Number(form.radius), startDate:form.startDate, endDate:form.endDate, recurring:form.recurring, status:"open" };
      setDemands(prev => editId ? prev.map(d => d.id===editId ? item : d) : [...prev, item]);
      setShowModal(false);
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this demand?")) return;
    await api.delete(`/api/v1/buyer/demands/${id}`).catch(()=>{});
    setDemands(prev => prev.filter(d => d.id !== id));
  };

  const f = (key: keyof FormData, val: string|boolean) => setForm(p => ({...p, [key]: val}));

  const tabs = [
    { key:"all", label:"All", badge: demands.length },
    { key:"open", label:"Open", badge: demands.filter(d=>d.status==="open").length },
    { key:"reviewing", label:"Reviewing", badge: demands.filter(d=>d.status==="reviewing").length },
    { key:"confirmed", label:"Confirmed", badge: demands.filter(d=>d.status==="confirmed").length },
    { key:"closed", label:"Closed" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-amber-600 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("buyer.myDemands")}</h1>
        <p className="text-amber-100 text-sm mt-1">{demands.length} total demands</p>
      </div>

      <Tabs tabs={tabs} defaultTab="all">
        {(activeTab) => {
          const filtered = activeTab==="all" ? demands : demands.filter(d => d.status===activeTab);
          return (
            <div className="px-4 py-4 space-y-3">
              {loading ? (
                Array.from({length:3}).map((_,i) => (
                  <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                    <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/3" />
                  </div>
                ))
              ) : filtered.length===0 ? (
                <EmptyState icon="📋" title="No demands here" description="Post your first demand to connect with farmers."
                  action={{ label: t("buyer.addDemand"), onClick: openCreate }} />
              ) : (
                filtered.map(demand => (
                  <Card key={demand.id} padding="md">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-neutral-900">{demand.crop}</h3>
                          <Badge color={STATUS_COLOR[demand.status]||"gray"} size="sm" dot>{demand.status}</Badge>
                          {demand.recurring && <Badge color="blue" size="sm">Recurring</Badge>}
                        </div>
                        <p className="text-sm text-neutral-600 mt-1">
                          {demand.quantity} {demand.unit} · Rs. {demand.minPrice}–{demand.maxPrice}/{demand.unit}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                          📍 {demand.location} ({demand.radius}km) · {demand.startDate} to {demand.endDate}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(demand)}>Edit</Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(demand.id)}>Delete</Button>
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
        className="fixed bottom-20 right-4 w-14 h-14 bg-amber-500 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-amber-600 active:scale-95 transition-transform z-10"
        aria-label="Add Demand">+</button>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editId ? "Edit Demand" : "New Demand"}
        size="lg"
        footer={
          <Button variant="accent" fullWidth loading={submitting}
            onClick={() => (document.getElementById("demand-form") as HTMLFormElement)?.requestSubmit()}>
            {editId ? "Update Demand" : "Post Demand"}
          </Button>
        }
      >
        <form id="demand-form" onSubmit={handleSubmit} className="space-y-4">
          <Select label="Crop" required value={form.crop} onChange={e => f("crop", e.target.value)}
            placeholder="Select a crop" options={CROPS.map(c => ({value:c,label:c}))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantity" type="number" required min="1" value={form.quantity}
              onChange={e => f("quantity", e.target.value)} placeholder="e.g. 500" />
            <Select label="Unit" value={form.unit} onChange={e => f("unit", e.target.value)}
              options={UNITS.map(u => ({value:u,label:u}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Min Price (Rs.)" type="number" required min="1" value={form.minPrice}
              onChange={e => f("minPrice", e.target.value)} placeholder="e.g. 100" />
            <Input label="Max Price (Rs.)" type="number" required min="1" value={form.maxPrice}
              onChange={e => f("maxPrice", e.target.value)} placeholder="e.g. 130" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Location" required value={form.location}
              onChange={e => f("location", e.target.value)} placeholder="e.g. Colombo" />
            <Input label="Radius (km)" type="number" min="1" value={form.radius}
              onChange={e => f("radius", e.target.value)} placeholder="50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" required value={form.startDate}
              onChange={e => f("startDate", e.target.value)} />
            <Input label="End Date" type="date" required value={form.endDate}
              onChange={e => f("endDate", e.target.value)} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              role="switch"
              aria-checked={form.recurring}
              onClick={() => f("recurring", !form.recurring)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.recurring ? "bg-amber-500" : "bg-neutral-300"}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.recurring ? "translate-x-5" : "translate-x-0"}`} />
            </div>
            <span className="text-sm font-medium text-neutral-700">Recurring demand</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
