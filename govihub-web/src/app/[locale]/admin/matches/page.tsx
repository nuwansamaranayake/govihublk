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
import { pluralize } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { formatStatus, cropName } from "@/lib/utils";

type MatchStatus = "proposed"|"farmer_accepted"|"buyer_accepted"|"in_transit"|"disputed"|"cancelled";

interface Match {
  id: string;
  farmerName: string;
  buyerName: string;
  crop: string;
  quantity: number;
  unit: string;
  price: number;
  score: number;
  status: MatchStatus;
  createdAt: string;
  disputeReason?: string;
}

const MOCK: Match[] = [
  { id:"1", farmerName:"Kamal Perera", buyerName:"Colombo Fresh Mart", crop:"Tomato", quantity:300, unit:"kg", price:115, score:92, status:"farmer_accepted", createdAt:"2026-03-20" },
  { id:"2", farmerName:"Nimal Silva", buyerName:"Lanka Supermart", crop:"Cabbage", quantity:200, unit:"kg", price:80, score:78, status:"disputed", createdAt:"2026-03-18", disputeReason:"Quality did not match description" },
  { id:"3", farmerName:"Saman Fernando", buyerName:"Green Foods Ltd", crop:"Carrot", quantity:150, unit:"kg", price:150, score:85, status:"in_transit", createdAt:"2026-03-10" },
  { id:"4", farmerName:"Ranjith Kumar", buyerName:"City Vegetables", crop:"Beans", quantity:100, unit:"kg", price:195, score:70, status:"proposed", createdAt:"2026-03-22" },
];

const STATUS_COLOR: Record<MatchStatus, "green"|"gold"|"gray"|"red"|"orange"|"blue"> = {
  proposed:"blue", farmer_accepted:"gold", buyer_accepted:"gold", in_transit:"orange", disputed:"red", cancelled:"gray",
};

export default function AdminMatchesPage() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Match|null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [resolveAction, setResolveAction] = useState<"favor_farmer"|"favor_buyer"|"cancel">("favor_farmer");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    api.get<Match[]>("/admin/matches")
      .then(setMatches)
      .catch(() => setMatches(MOCK))
      .finally(() => setLoading(false));
  }, []);

  const openResolve = (match: Match) => {
    setSelected(match);
    setResolution("");
    setResolveOpen(true);
  };

  const handleResolve = async () => {
    if (!selected || !resolution.trim()) return;
    setResolving(true);
    try {
      await api.post(`/admin/matches/${selected.id}/resolve`, { action:resolveAction, note:resolution });
      const newStatus: MatchStatus = resolveAction==="cancel" ? "cancelled" : "in_transit";
      setMatches(prev => prev.map(m => m.id===selected.id ? {...m, status:newStatus} : m));
      setResolveOpen(false);
    } catch {
      setMatches(prev => prev.map(m => m.id===selected.id ? {...m, status:"in_transit"} : m));
      setResolveOpen(false);
    } finally { setResolving(false); }
  };

  const scoreColor = (s: number) => s>=85?"text-green-600":s>=70?"text-amber-500":"text-red-500";

  const allStatuses: MatchStatus[] = ["proposed","farmer_accepted","buyer_accepted","in_transit","disputed","cancelled"];
  const tabs = [
    { key:"all", label:"All", badge: matches.length },
    ...allStatuses.map(s => ({
      key: s, label: formatStatus(s),
      badge: matches.filter(m=>m.status===s).length,
    })),
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      <div className="bg-neutral-800 px-6 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">Match Management</h1>
        <p className="text-neutral-300 text-sm mt-1">{pluralize(matches.filter(m=>m.status==="disputed").length, "dispute")} pending</p>
      </div>

      {/* Search */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <Input placeholder="Search by farmer, buyer, or crop..." value={search}
          onChange={e => setSearch(e.target.value)} leftIcon={<span>🔍</span>} />
      </div>

      <Tabs tabs={tabs} defaultTab="all">
        {(activeTab) => {
          const filtered = matches
            .filter(m => activeTab==="all" || m.status===activeTab)
            .filter(m => !search || m.farmerName.toLowerCase().includes(search.toLowerCase()) || m.buyerName.toLowerCase().includes(search.toLowerCase()) || cropName(m.crop, locale).toLowerCase().includes(search.toLowerCase()));
          return (
            <div className="px-4 py-4 space-y-3">
              {loading ? (
                Array.from({length:4}).map((_,i) => (
                  <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                    <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" />
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <EmptyState icon="🤝" title="No matches found" />
              ) : (
                filtered.map(match => (
                  <Card key={match.id} padding="md">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge color={STATUS_COLOR[match.status]} size="sm" dot>{formatStatus(match.status)}</Badge>
                          <span className="text-xs text-neutral-400">#{match.id}</span>
                        </div>
                        <p className="text-sm font-semibold text-neutral-900 mt-1">
                          Score: {Math.round((match.score || 0) * 100)}%
                        </p>
                        <p className="text-xs text-neutral-600 mt-0.5">
                          {match.price ? `Rs. ${match.price}/kg` : "Price TBD"}
                          {match.quantity ? ` · ${match.quantity} ${match.unit}` : ""}
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {match.createdAt ? new Date(match.createdAt).toLocaleDateString() : ""}
                        </p>
                        {match.disputeReason && (
                          <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            <p className="text-xs text-red-700">⚠️ {match.disputeReason}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-center shrink-0">
                        <div className={`text-xl font-bold ${scoreColor(match.score)}`}>{match.score}</div>
                        <p className="text-[10px] text-neutral-400">Score</p>
                      </div>
                    </div>
                    {match.status==="disputed" && (
                      <div className="pt-2 border-t border-neutral-100">
                        <Button variant="danger" size="sm" onClick={() => openResolve(match)}>
                          Resolve Dispute
                        </Button>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          );
        }}
      </Tabs>

      {/* Dispute Resolution Modal */}
      <Modal
        isOpen={resolveOpen}
        onClose={() => setResolveOpen(false)}
        title="Resolve Dispute"
        size="lg"
        footer={
          <Button variant="primary" fullWidth loading={resolving} onClick={handleResolve}>
            Resolve
          </Button>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-sm font-medium text-red-800">Match #{selected.id}</p>
              <p className="text-xs text-red-600 mt-1">Score: {Math.round((selected.score || 0) * 100)}% · {formatStatus(selected.status)}</p>
              {selected.disputeReason && (
                <p className="text-xs text-red-700 mt-1">Reason: {selected.disputeReason}</p>
              )}
            </div>
            <Select
              label="Resolution Action"
              value={resolveAction}
              onChange={e => setResolveAction(e.target.value as typeof resolveAction)}
              options={[
                {value:"favor_farmer",label:"Favor Farmer"},
                {value:"favor_buyer",label:"Favor Buyer"},
                {value:"cancel",label:"Cancel Match"},
              ]}
            />
            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1.5">Resolution Note *</label>
              <textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 resize-none"
                placeholder="Explain the resolution decision..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
