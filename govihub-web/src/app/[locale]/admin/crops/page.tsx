"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth";
import { useSector } from "@/hooks/useSector";

type CropCategory = "vegetable"|"fruit"|"grain"|"spice"|"legume"|"leafy";

interface Crop {
  id: string;
  name: string;
  nameSinhala: string;
  nameTamil: string;
  category: CropCategory;
  season: string;
  avgYield: string;
  growingDays: number;
  active: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normaliseCrop(raw: any): Crop {
  const season = raw.season;
  let seasonStr = "";
  if (typeof season === "string") seasonStr = season;
  else if (season && typeof season === "object") {
    const parts: string[] = [];
    if (season.maha) parts.push("Maha");
    if (season.yala) parts.push("Yala");
    seasonStr = parts.join(" & ") || "All year";
  }
  return {
    id: raw.id,
    name: raw.name ?? raw.name_en ?? "",
    nameSinhala: raw.nameSinhala ?? raw.name_si ?? "",
    nameTamil: raw.nameTamil ?? raw.name_ta ?? "",
    category: raw.category ?? "spice",
    season: seasonStr,
    avgYield: raw.avgYield ?? (raw.avg_yield_kg ? `${raw.avg_yield_kg} kg/ha` : ""),
    growingDays: raw.growingDays ?? raw.growing_days ?? 0,
    active: raw.active ?? raw.is_active ?? true,
  };
}


const CATEGORIES: CropCategory[] = ["vegetable","fruit","grain","spice","legume","leafy"];
// Default category is set inside the component via useSector()
const EMPTY_FORM = { name:"", nameSinhala:"", nameTamil:"", category:"spice" as CropCategory, season:"", avgYield:"", growingDays:"", active:true };
type CropForm = typeof EMPTY_FORM;

const CAT_COLOR: Record<CropCategory, "green"|"gold"|"blue"|"orange"|"purple"|"darkgreen"> = {
  vegetable:"green", fruit:"gold", grain:"gold", spice:"orange", legume:"purple", leafy:"darkgreen",
};

export default function AdminCropsPage() {
  const t = useTranslations();
  const { isReady } = useAuth();
  const { cropPlaceholder, cropPlaceholderSi, cropPlaceholderTa, defaultCropCategory } = useSector();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState<CropForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    api.get<any>("/admin/crops")
      .then((data) => {
        const raw = Array.isArray(data) ? data : (data?.items ?? []);
        setCrops(raw.map(normaliseCrop));
      })
      .catch(() => setCrops([]))
      .finally(() => setLoading(false));

  useEffect(() => { if (isReady) load(); }, [isReady]);

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (c: Crop) => {
    setEditId(c.id);
    setForm({ name:c.name, nameSinhala:c.nameSinhala, nameTamil:c.nameTamil, category:c.category, season:c.season, avgYield:c.avgYield, growingDays:String(c.growingDays), active:c.active });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) await api.put(`/admin/crops/${editId}`, form);
      else await api.post("/admin/crops", form);
      setShowModal(false);
      await load();
    } catch {
      const item: Crop = { id:editId||String(Date.now()), name:form.name, nameSinhala:form.nameSinhala, nameTamil:form.nameTamil, category:form.category, season:form.season, avgYield:form.avgYield, growingDays:Number(form.growingDays), active:form.active };
      setCrops(prev => editId ? prev.map(c => c.id===editId ? item : c) : [...prev, item]);
      setShowModal(false);
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this crop?")) return;
    await api.delete(`/admin/crops/${id}`).catch(()=>{});
    setCrops(prev => prev.filter(c => c.id !== id));
  };

  const f = (key: keyof CropForm, val: string|boolean) => setForm(p => ({...p, [key]: val}));

  const filtered = crops.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.nameSinhala.includes(search);
    const matchCat = categoryFilter==="all" || c.category===categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      <div className="bg-neutral-800 px-6 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">Crop Taxonomy</h1>
        <p className="text-neutral-300 text-sm mt-1">{crops.length} crops defined</p>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3 space-y-2">
        <Input placeholder="Search crops..." value={search}
          onChange={e => setSearch(e.target.value)} leftIcon={<span>🔍</span>} />
        <Select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          options={[{value:"all",label:"All Categories"}, ...CATEGORIES.map(c => ({value:c, label:c.charAt(0).toUpperCase()+c.slice(1)}))]}
        />
        <p className="text-xs text-neutral-400">{filtered.length} results</p>
      </div>

      {/* Table */}
      <div className="px-4 py-4 space-y-2">
        {loading ? (
          Array.from({length:5}).map((_,i) => (
            <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
              <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <EmptyState icon="🌾" title="No crops found" action={{ label:"Add Crop", onClick:openCreate }} />
        ) : (
          filtered.map(crop => (
            <Card key={crop.id} padding="md">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-neutral-900">{crop.name}</h3>
                    <Badge color={CAT_COLOR[crop.category]} size="sm">{crop.category}</Badge>
                    {!crop.active && <Badge color="gray" size="sm">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {crop.nameSinhala} · {crop.nameTamil}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-neutral-400">
                    <span>Season: {crop.season}</span>
                    <span>Yield: {crop.avgYield}</span>
                    <span>{crop.growingDays} days</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(crop)}>Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(crop.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* FAB */}
      <button onClick={openCreate}
        className="fixed bottom-8 right-4 w-14 h-14 bg-neutral-800 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-neutral-700 active:scale-95 transition-transform z-10"
        aria-label="Add Crop">+</button>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editId ? "Edit Crop" : "New Crop"}
        size="lg"
        footer={
          <Button variant="primary" fullWidth loading={submitting}
            onClick={() => (document.getElementById("crop-form") as HTMLFormElement)?.requestSubmit()}>
            {editId ? "Update Crop" : "Create Crop"}
          </Button>
        }
      >
        <form id="crop-form" onSubmit={handleSubmit} className="space-y-4">
          <Input label="English Name" required value={form.name} onChange={e => f("name", e.target.value)} placeholder={cropPlaceholder} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Sinhala Name" value={form.nameSinhala} onChange={e => f("nameSinhala", e.target.value)} placeholder={cropPlaceholderSi} />
            <Input label="Tamil Name" value={form.nameTamil} onChange={e => f("nameTamil", e.target.value)} placeholder={cropPlaceholderTa} />
          </div>
          <Select label="Category" value={form.category} onChange={e => f("category", e.target.value)}
            options={CATEGORIES.map(c => ({value:c, label:c.charAt(0).toUpperCase()+c.slice(1)}))} />
          <Input label="Growing Season" value={form.season} onChange={e => f("season", e.target.value)} placeholder="e.g. All year, Oct-Mar" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Average Yield" value={form.avgYield} onChange={e => f("avgYield", e.target.value)} placeholder="e.g. 15-20 t/ha" />
            <Input label="Growing Days" type="number" min="1" value={form.growingDays} onChange={e => f("growingDays", e.target.value)} placeholder="e.g. 75" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div role="switch" aria-checked={form.active} onClick={() => f("active", !form.active)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.active?"bg-green-500":"bg-neutral-300"}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active?"translate-x-5":"translate-x-0"}`} />
            </div>
            <span className="text-sm font-medium text-neutral-700">Active in system</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
