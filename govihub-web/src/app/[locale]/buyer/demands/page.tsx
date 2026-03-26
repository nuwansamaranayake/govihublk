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
import { cropName } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

interface Demand {
  id: string;
  crop: any; // object: {id, name_en, name_si, category}
  crop_id: number;
  variety: string;
  quantity_kg: number;
  max_price_per_kg: number;
  needed_by: string;
  radius_km: number;
  latitude: number;
  longitude: number;
  description: string;
  quality_grade: string;
  is_recurring: boolean;
  recurrence_pattern: string;
  buyer_id: string;
  status: "open"|"reviewing"|"confirmed"|"closed"|"expired";
  created_at: string;
  updated_at: string;
}

const CROPS = ["Tomato","Cabbage","Carrot","Beans","Potato","Onion","Chilli","Brinjal","Cucumber","Pumpkin","Leek","Radish"];


const EMPTY_FORM = { crop_id:"", variety:"", quantity_kg:"", max_price_per_kg:"", radius_km:"50", needed_by:"", description:"", quality_grade:"A", is_recurring:false };
type FormData = typeof EMPTY_FORM;

const STATUS_COLOR: Record<string,"green"|"gold"|"gray"|"red"|"blue"|"darkgreen"> = { open:"blue", reviewing:"gold", confirmed:"darkgreen", closed:"gray", expired:"gray" };

export default function BuyerDemandsPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { isReady } = useAuth();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get<any>("/listings/demand")
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        setDemands(items);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load demands");
        setDemands([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isReady) load(); }, [isReady]);

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (d: Demand) => {
    setEditId(d.id);
    setForm({ crop_id:String(d.crop_id || ''), variety:d.variety || '', quantity_kg:String(d.quantity_kg), max_price_per_kg:String(d.max_price_per_kg), radius_km:String(d.radius_km || '50'), needed_by:d.needed_by?.split('T')[0] || '', description:d.description || '', quality_grade:d.quality_grade || 'A', is_recurring:d.is_recurring || false });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) await api.put(`/listings/demand/${editId}`, form);
      else await api.post("/listings/demand", form);
      setShowModal(false);
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to save demand");
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("common.deleteConfirmDemand"))) return;
    try {
      await api.delete(`/listings/demand/${id}`);
      setDemands(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      setError(err?.message || "Failed to delete demand");
    }
  };

  const f = (key: keyof FormData, val: string|boolean) => setForm(p => ({...p, [key]: val}));

  const tabs = [
    { key:"all", label: t("common.all"), badge: demands.length },
    { key:"open", label: t("status.open"), badge: demands.filter(d=>d.status==="open").length },
    { key:"reviewing", label: t("status.reviewing"), badge: demands.filter(d=>d.status==="reviewing").length },
    { key:"confirmed", label: t("status.confirmed"), badge: demands.filter(d=>d.status==="confirmed").length },
    { key:"closed", label: t("status.closed") },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-amber-600 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("buyer.myDemands")}</h1>
        <p className="text-amber-100 text-sm mt-1">{demands.length} {t("common.total")}</p>
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
                <EmptyState icon="📋" title={t("common.noDemands")} description={t("common.postFirstDemand")}
                  action={{ label: t("buyer.addDemand"), onClick: openCreate }} />
              ) : (
                filtered.map(demand => (
                  <Card key={demand.id} padding="md">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-neutral-900">{cropName(demand.crop, locale)}</h3>
                          <Badge color={STATUS_COLOR[demand.status]||"gray"} size="sm" dot>{demand.status}</Badge>
                          {demand.is_recurring && <Badge color="blue" size="sm">{t("common.recurring")}</Badge>}
                        </div>
                        <p className="text-sm text-neutral-600 mt-1">
                          {demand.quantity_kg} kg · Rs. {demand.max_price_per_kg}/kg max
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">
                          🗓 Need by: {demand.needed_by ? new Date(demand.needed_by).toLocaleDateString() : ''} · {demand.radius_km}km radius
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(demand)}>{t("common.edit")}</Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(demand.id)}>{t("common.delete")}</Button>
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
        aria-label={t("buyer.addDemand")}>+</button>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editId ? t("buyer.editDemand") : t("buyer.newDemand")}
        size="lg"
        footer={
          <Button variant="accent" fullWidth loading={submitting}
            onClick={() => (document.getElementById("demand-form") as HTMLFormElement)?.requestSubmit()}>
            {editId ? t("buyer.updateDemand") : t("buyer.postDemand")}
          </Button>
        }
      >
        <form id="demand-form" onSubmit={handleSubmit} className="space-y-4">
          <Select label={t("buyer.cropName")} required value={form.crop_id} onChange={e => f("crop_id", e.target.value)}
            placeholder={t("listing.selectCrop")} options={CROPS.map((c, i) => ({value:String(i+1),label:c}))} />
          <Input label={t("buyer.variety")} value={form.variety}
            onChange={e => f("variety", e.target.value)} placeholder="e.g. Big Beef" />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("buyer.quantity") + " (kg)"} type="number" required min="1" value={form.quantity_kg}
              onChange={e => f("quantity_kg", e.target.value)} placeholder="e.g. 500" />
            <Input label={t("buyer.maxPrice") + " (Rs/kg)"} type="number" required min="1" value={form.max_price_per_kg}
              onChange={e => f("max_price_per_kg", e.target.value)} placeholder="e.g. 130" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("buyer.neededBy")} type="date" required value={form.needed_by}
              onChange={e => f("needed_by", e.target.value)} />
            <Input label={t("buyer.radius") + " (km)"} type="number" min="1" value={form.radius_km}
              onChange={e => f("radius_km", e.target.value)} placeholder="50" />
          </div>
          <Select label={t("buyer.qualityGrade")} value={form.quality_grade} onChange={e => f("quality_grade", e.target.value)}
            options={["A","B","C"].map(g => ({value:g, label:`Grade ${g}`}))} />
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              role="switch"
              aria-checked={form.is_recurring}
              onClick={() => f("is_recurring", !form.is_recurring)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.is_recurring ? "bg-amber-500" : "bg-neutral-300"}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_recurring ? "translate-x-5" : "translate-x-0"}`} />
            </div>
            <span className="text-sm font-medium text-neutral-700">{t("buyer.recurringDemand")}</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
