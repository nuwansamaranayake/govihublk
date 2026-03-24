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
import { Tabs } from "@/components/ui/Tabs";

type KnowledgeType = "crop_guide"|"pest_guide"|"market_info"|"weather"|"advisory"|"other";

interface KnowledgeChunk {
  id: string;
  title: string;
  type: KnowledgeType;
  content: string;
  language: "en"|"si"|"ta";
  source: string;
  tokenCount: number;
  createdAt: string;
}

interface KnowledgeStats {
  totalChunks: number;
  byType: Record<KnowledgeType, number>;
  byLanguage: { en: number; si: number; ta: number };
  lastIngested: string;
}

const MOCK_CHUNKS: KnowledgeChunk[] = [
  { id:"1", title:"Tomato Cultivation Guide", type:"crop_guide", content:"Tomatoes thrive in warm climates with temperatures between 20-30°C...", language:"en", source:"Dept. of Agriculture Sri Lanka", tokenCount:1245, createdAt:"2026-03-10" },
  { id:"2", title:"Early Blight Disease Control", type:"pest_guide", content:"Early blight is caused by Alternaria solani. Apply copper fungicide...", language:"en", source:"Plant Protection Service", tokenCount:876, createdAt:"2026-03-08" },
  { id:"3", title:"තක්කාලි වගා මාර්ගෝපදේශය", type:"crop_guide", content:"තක්කාලි 20-30°C අතර උෂ්ණත්වය හා හිරු එළිය අවශ්‍ය...", language:"si", source:"ගොවිජන සේවා දෙපාර්තමේන්තුව", tokenCount:1100, createdAt:"2026-03-07" },
  { id:"4", title:"Market Price Analysis Q1 2026", type:"market_info", content:"Vegetable prices in Q1 2026 showed 12% increase for tomatoes...", language:"en", source:"GoviHub Analytics", tokenCount:654, createdAt:"2026-03-05" },
];

const MOCK_STATS: KnowledgeStats = {
  totalChunks: 248,
  byType: { crop_guide:98, pest_guide:67, market_info:34, weather:22, advisory:19, other:8 },
  byLanguage: { en:162, si:68, ta:18 },
  lastIngested: "2026-03-20 14:30",
};

const EMPTY_INGEST = { title:"", type:"crop_guide" as KnowledgeType, content:"", source:"", language:"en" as "en"|"si"|"ta" };
type IngestForm = typeof EMPTY_INGEST;

const TYPE_LABELS: Record<KnowledgeType, string> = {
  crop_guide:"Crop Guide", pest_guide:"Pest Guide", market_info:"Market Info",
  weather:"Weather", advisory:"Advisory", other:"Other",
};

const LANG_BADGE: Record<string, "green"|"gold"|"blue"> = { en:"green", si:"gold", ta:"blue" };

export default function AdminKnowledgePage() {
  const t = useTranslations();
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [stats, setStats] = useState<KnowledgeStats|null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ingestOpen, setIngestOpen] = useState(false);
  const [form, setForm] = useState<IngestForm>(EMPTY_INGEST);
  const [ingesting, setIngesting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<KnowledgeChunk[]>("/admin/knowledge"),
      api.get<KnowledgeStats>("/admin/knowledge/stats"),
    ])
      .then(([c,s]) => { setChunks(c); setStats(s); })
      .catch(() => { setChunks(MOCK_CHUNKS); setStats(MOCK_STATS); })
      .finally(() => setLoading(false));
  }, []);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngesting(true);
    try {
      await api.post("/admin/knowledge/ingest", form);
      const fresh = await api.get<KnowledgeChunk[]>("/admin/knowledge");
      setChunks(fresh);
      setIngestOpen(false);
      setForm(EMPTY_INGEST);
    } catch {
      const item: KnowledgeChunk = { id:String(Date.now()), title:form.title, type:form.type, content:form.content, language:form.language, source:form.source, tokenCount:Math.floor(form.content.length/4), createdAt:new Date().toISOString().split("T")[0] };
      setChunks(prev => [item, ...prev]);
      setIngestOpen(false);
      setForm(EMPTY_INGEST);
    } finally { setIngesting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this knowledge chunk?")) return;
    await api.delete(`/admin/knowledge/${id}`).catch(()=>{});
    setChunks(prev => prev.filter(c => c.id !== id));
  };

  const f = (key: keyof IngestForm, val: string) => setForm(p => ({...p, [key]: val}));

  const filtered = chunks.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.source.toLowerCase().includes(search.toLowerCase())
  );

  const tabs = [
    { key:"chunks", label:"Knowledge Chunks", badge: chunks.length },
    { key:"stats", label:"Statistics" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      <div className="bg-neutral-800 px-6 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">Knowledge Base</h1>
        <p className="text-neutral-300 text-sm mt-1">Manage RAG knowledge chunks</p>
      </div>

      <Tabs tabs={tabs} defaultTab="chunks">
        {(activeTab) => activeTab === "chunks" ? (
          <div>
            <div className="bg-white border-b border-neutral-200 px-4 py-3">
              <Input placeholder="Search chunks..." value={search}
                onChange={e => setSearch(e.target.value)} leftIcon={<span>🔍</span>} />
            </div>
            <div className="px-4 py-4 space-y-3">
              {loading ? (
                Array.from({length:4}).map((_,i) => (
                  <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                    <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/3" />
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <EmptyState icon="📚" title="No knowledge chunks found" />
              ) : (
                filtered.map(chunk => (
                  <Card key={chunk.id} padding="md">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-neutral-900 text-sm">{chunk.title}</h3>
                          <Badge color="gray" size="sm">{TYPE_LABELS[chunk.type]}</Badge>
                          <Badge color={LANG_BADGE[chunk.language]||"gray"} size="sm">{chunk.language.toUpperCase()}</Badge>
                        </div>
                        <p className="text-xs text-neutral-500 line-clamp-2">{chunk.content}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <p className="text-xs text-neutral-400">📄 {chunk.source}</p>
                          <p className="text-xs text-neutral-400">{chunk.tokenCount} tokens</p>
                          <p className="text-xs text-neutral-400">{chunk.createdAt}</p>
                        </div>
                      </div>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(chunk.id)}>Delete</Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-4">
            {loading ? <Skeleton className="h-64 w-full" /> : stats ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:"Total Chunks", value:stats.totalChunks, color:"text-neutral-800" },
                    { label:"Last Ingested", value:stats.lastIngested, color:"text-green-600" },
                  ].map(s => (
                    <Card key={s.label} padding="sm" className="text-center">
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
                    </Card>
                  ))}
                </div>
                <Card header={<h3 className="font-semibold text-neutral-800 text-sm">By Type</h3>} padding="md">
                  <div className="space-y-2 mt-2">
                    {Object.entries(stats.byType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm text-neutral-600">{TYPE_LABELS[type as KnowledgeType]}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div className="h-full bg-neutral-700 rounded-full" style={{width:`${(count/stats.totalChunks)*100}%`}} />
                          </div>
                          <span className="text-sm font-medium text-neutral-800 w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card header={<h3 className="font-semibold text-neutral-800 text-sm">By Language</h3>} padding="md">
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {[{lang:"English",key:"en",count:stats.byLanguage.en},{lang:"Sinhala",key:"si",count:stats.byLanguage.si},{lang:"Tamil",key:"ta",count:stats.byLanguage.ta}].map(l => (
                      <div key={l.key} className="text-center bg-neutral-50 rounded-xl p-3">
                        <p className="text-xl font-bold text-neutral-800">{l.count}</p>
                        <p className="text-xs text-neutral-500">{l.lang}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            ) : null}
          </div>
        )}
      </Tabs>

      {/* FAB */}
      <button onClick={() => setIngestOpen(true)}
        className="fixed bottom-8 right-4 w-14 h-14 bg-neutral-800 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-neutral-700 active:scale-95 transition-transform z-10"
        aria-label="Ingest Knowledge">+</button>

      {/* Ingest Modal */}
      <Modal isOpen={ingestOpen} onClose={() => setIngestOpen(false)}
        title="Ingest Knowledge Chunk" size="lg"
        footer={
          <Button variant="primary" fullWidth loading={ingesting}
            onClick={() => (document.getElementById("ingest-form") as HTMLFormElement)?.requestSubmit()}>
            Ingest
          </Button>
        }
      >
        <form id="ingest-form" onSubmit={handleIngest} className="space-y-4">
          <Input label="Title" required value={form.title} onChange={e => f("title", e.target.value)} placeholder="e.g. Tomato Cultivation Guide" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={form.type} onChange={e => f("type", e.target.value)}
              options={Object.entries(TYPE_LABELS).map(([v,l]) => ({value:v,label:l}))} />
            <Select label="Language" value={form.language} onChange={e => f("language", e.target.value)}
              options={[{value:"en",label:"English"},{value:"si",label:"Sinhala"},{value:"ta",label:"Tamil"}]} />
          </div>
          <Input label="Source" value={form.source} onChange={e => f("source", e.target.value)}
            placeholder="e.g. Dept. of Agriculture" />
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">Content *</label>
            <textarea required value={form.content} onChange={e => f("content", e.target.value)} rows={8}
              className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 resize-none"
              placeholder="Paste knowledge content here..." />
            <p className="text-xs text-neutral-400 mt-1">~{Math.floor(form.content.length/4)} tokens</p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
