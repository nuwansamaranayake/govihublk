"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

interface FeedbackEntry {
  id: string;
  user_id: string | null;
  page_url: string;
  message: string;
  rating: number | null;
  category: string;
  language: string | null;
  status: string;
  priority: string | null;
  admin_notes: string | null;
  user_agent: string | null;
  created_at: string;
}

const CATEGORY_OPTIONS = ["all", "bug", "idea", "general"] as const;
const STATUS_OPTIONS = ["all", "new", "reviewed", "planned", "done"] as const;

const CATEGORY_BADGES: Record<string, { label: string; color: string }> = {
  bug: { label: "\uD83D\uDC1B Bug", color: "bg-red-100 text-red-700" },
  idea: { label: "\uD83D\uDCA1 Idea", color: "bg-yellow-100 text-yellow-700" },
  general: { label: "\uD83D\uDCAC General", color: "bg-blue-100 text-blue-700" },
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-green-100 text-green-700" },
  reviewed: { label: "Reviewed", color: "bg-blue-100 text-blue-700" },
  planned: { label: "Planned", color: "bg-purple-100 text-purple-700" },
  done: { label: "Done", color: "bg-neutral-100 text-neutral-600" },
};

const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"] as const;

const LANG_FLAGS: Record<string, string> = {
  en: "\uD83C\uDDEC\uD83C\uDDE7",
  si: "\uD83C\uDDF1\uD83C\uDDF0",
};

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs text-neutral-400">No rating</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill={star <= rating ? "#F59E0B" : "none"}
          stroke={star <= rating ? "#F59E0B" : "#D1D5DB"}
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      ))}
    </div>
  );
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Local edit state for expanded item
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const fetchFeedback = () => {
    const params = new URLSearchParams();
    if (filterCategory !== "all") params.set("category", filterCategory);
    if (filterStatus !== "all") params.set("status", filterStatus);
    const qs = params.toString();

    setLoading(true);
    api
      .get<FeedbackEntry[]>(`/admin/feedback${qs ? `?${qs}` : ""}`)
      .then((data) => setFeedback(Array.isArray(data) ? data : []))
      .catch(() => setFeedback([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterStatus]);

  const handleExpand = (entry: FeedbackEntry) => {
    if (expandedId === entry.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(entry.id);
    setEditStatus(entry.status || "new");
    setEditPriority(entry.priority || "");
    setEditNotes(entry.admin_notes || "");
  };

  const handleSave = async (feedbackId: string) => {
    setSaving(feedbackId);
    try {
      await api.patch(`/admin/feedback/${feedbackId}`, {
        status: editStatus,
        priority: editPriority || null,
        admin_notes: editNotes || null,
      });
      // Update local state
      setFeedback((prev) =>
        prev.map((f) =>
          f.id === feedbackId
            ? { ...f, status: editStatus, priority: editPriority || null, admin_notes: editNotes || null }
            : f
        )
      );
      setExpandedId(null);
    } catch {
      // Silently fail — could add toast later
    } finally {
      setSaving(null);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    const isoDate = d.split("T")[0];
    const parts = isoDate.split("-");
    if (parts.length !== 3) return d;
    const [y, m, day] = parts;
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthStr = MONTHS[parseInt(m, 10) - 1];
    const dayNum = parseInt(day, 10);
    // Extract time from ISO string if present
    const timePart = d.includes("T") ? d.split("T")[1] : "";
    let timeStr = "";
    if (timePart) {
      const [hh, mm] = timePart.split(":");
      if (hh && mm) {
        const hour = parseInt(hh, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const h12 = hour % 12 || 12;
        timeStr = `, ${String(h12).padStart(2, "0")}:${mm} ${ampm}`;
      }
    }
    return `${monthStr} ${dayNum}, ${y}${timeStr}`;
  };

  if (loading) {
    return (
      <div className="px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">User Feedback</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Review feedback submitted by beta testers
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-600">Category:</span>
          <div className="flex rounded-lg border border-neutral-200 overflow-hidden">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterCategory === cat
                    ? "bg-green-600 text-white"
                    : "text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {cat === "all" ? "All" : CATEGORY_BADGES[cat]?.label || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-600">Status:</span>
          <div className="flex rounded-lg border border-neutral-200 overflow-hidden">
            {STATUS_OPTIONS.map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterStatus === st
                    ? "bg-green-600 text-white"
                    : "text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {st === "all" ? "All" : STATUS_BADGES[st]?.label || st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <Card padding="none">
        {feedback.length === 0 ? (
          <EmptyState
            title="No feedback yet"
            description="Feedback from users will appear here."
            icon={
              <svg
                className="w-16 h-16 text-neutral-300 mx-auto"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.2}
                viewBox="0 0 48 48"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 20h.01M24 20h.01M36 20h.01M42 24c0 8.837-8.059 16-18 16a19.727 19.727 0 01-8.51-1.898L6 40l2.79-7.44C7.024 30.084 6 27.148 6 24c0-8.837 8.059-16 18-16s18 7.163 18 16z"
                />
              </svg>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-600">Category</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Lang</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Page</th>
                  <th className="px-4 py-3 font-medium text-neutral-600 min-w-[200px]">
                    Message
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Rating</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((entry) => {
                  const catBadge = CATEGORY_BADGES[entry.category] || CATEGORY_BADGES.general;
                  const statusBadge = STATUS_BADGES[entry.status] || STATUS_BADGES.new;
                  const langFlag = entry.language ? LANG_FLAGS[entry.language] || "" : "";
                  const isExpanded = expandedId === entry.id;

                  return (
                    <tr key={entry.id} className="group">
                      <td colSpan={7} className="p-0">
                        {/* Main Row */}
                        <div
                          className={`flex items-center cursor-pointer border-b transition-colors ${
                            isExpanded ? "bg-green-50/50 border-green-100" : "border-neutral-100 hover:bg-neutral-50/60"
                          }`}
                          onClick={() => handleExpand(entry)}
                        >
                          <div className="px-4 py-3 w-[100px]">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${catBadge.color}`}>
                              {catBadge.label}
                            </span>
                          </div>
                          <div className="px-4 py-3 w-[60px] text-center text-base">
                            {langFlag}
                          </div>
                          <div className="px-4 py-3 w-[140px] text-xs text-neutral-500 font-mono truncate">
                            {entry.page_url}
                          </div>
                          <div className="px-4 py-3 flex-1 text-neutral-700 min-w-[200px]">
                            <p className="line-clamp-2">{entry.message}</p>
                          </div>
                          <div className="px-4 py-3 w-[120px]">
                            <StarRating rating={entry.rating} />
                          </div>
                          <div className="px-4 py-3 w-[100px]">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}>
                              {statusBadge.label}
                            </span>
                          </div>
                          <div className="px-4 py-3 w-[140px] text-xs text-neutral-500 whitespace-nowrap">
                            {formatDate(entry.created_at)}
                          </div>
                        </div>

                        {/* Expanded Detail */}
                        {isExpanded && (
                          <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-200 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Status */}
                              <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Status</label>
                                <select
                                  value={editStatus}
                                  onChange={(e) => setEditStatus(e.target.value)}
                                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                >
                                  {STATUS_OPTIONS.filter((s) => s !== "all").map((s) => (
                                    <option key={s} value={s}>
                                      {STATUS_BADGES[s]?.label || s}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Priority */}
                              <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Priority</label>
                                <select
                                  value={editPriority}
                                  onChange={(e) => setEditPriority(e.target.value)}
                                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                >
                                  <option value="">None</option>
                                  {PRIORITY_OPTIONS.map((p) => (
                                    <option key={p} value={p}>
                                      {p.charAt(0).toUpperCase() + p.slice(1)}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Meta */}
                              <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Info</label>
                                <div className="text-xs text-neutral-500 space-y-1">
                                  <p>User: {entry.user_id || "Anonymous"}</p>
                                  <p>Agent: {entry.user_agent ? entry.user_agent.slice(0, 60) + "..." : "N/A"}</p>
                                </div>
                              </div>
                            </div>

                            {/* Admin Notes */}
                            <div>
                              <label className="block text-xs font-medium text-neutral-500 mb-1">Admin Notes</label>
                              <textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                rows={3}
                                placeholder="Add notes about this feedback..."
                                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                              />
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end gap-3">
                              <button
                                onClick={() => setExpandedId(null)}
                                className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-600 text-sm hover:bg-neutral-100 transition"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSave(entry.id)}
                                disabled={saving === entry.id}
                                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition disabled:opacity-50"
                              >
                                {saving === entry.id ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
