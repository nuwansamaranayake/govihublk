"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth";

// ── Types ────────────────────────────────────────────────────────────────────

interface AdSummary {
  total_ads: number;
  active_ads: number;
  total_impressions: number;
  total_clicks: number;
  overall_ctr: number;
}

interface Ad {
  id: string;
  title_en: string;
  title_si?: string;
  description_en?: string;
  description_si?: string;
  image_url?: string;
  click_url?: string;
  target_roles: string[];
  target_districts: string[];
  is_active: boolean;
  starts_at: string;
  ends_at?: string | null;
  display_order: number;
  advertiser_name?: string;
  advertiser_contact?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  created_at: string;
}

interface AdStats {
  total_impressions: number;
  total_clicks: number;
  ctr: number;
  by_role: { role: string; impressions: number; clicks: number; ctr: number }[];
  by_day: { date: string; impressions: number; clicks: number }[];
  top_districts: { district: string; impressions: number; clicks: number }[];
}

interface AdFormData {
  title_en: string;
  title_si: string;
  description_en: string;
  description_si: string;
  click_url: string;
  target_roles: string[];
  target_districts: string;
  starts_at: string;
  ends_at: string;
  display_order: number;
  advertiser_name: string;
  advertiser_contact: string;
}

const ROLES = ["farmer", "buyer", "supplier"];

const ROLE_LABELS: Record<string, string> = {
  farmer: "Farmer",
  buyer: "Buyer",
  supplier: "Supplier",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAdStatus(ad: Ad): { label: string; color: string } {
  const now = new Date();
  const start = new Date(ad.starts_at);
  const end = ad.ends_at ? new Date(ad.ends_at) : null;

  if (end && end <= now) return { label: "Expired", color: "bg-neutral-400" };
  if (!ad.is_active) return { label: "Paused", color: "bg-yellow-400" };
  if (start > now) return { label: "Scheduled", color: "bg-blue-400" };
  return { label: "Active", color: "bg-green-500" };
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

const emptyForm: AdFormData = {
  title_en: "",
  title_si: "",
  description_en: "",
  description_si: "",
  click_url: "",
  target_roles: [],
  target_districts: "",
  starts_at: todayStr(),
  ends_at: "",
  display_order: 0,
  advertiser_name: "",
  advertiser_contact: "",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminAdsPage() {
  const { isReady } = useAuth();

  // Summary stats
  const [summary, setSummary] = useState<AdSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Ad list
  const [ads, setAds] = useState<Ad[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [form, setForm] = useState<AdFormData>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats modal
  const [statsAd, setStatsAd] = useState<Ad | null>(null);
  const [stats, setStats] = useState<AdStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Delete confirm
  const [deleteAd, setDeleteAd] = useState<Ad | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchSummary = useCallback(() => {
    setSummaryLoading(true);
    api
      .get<AdSummary>("/admin/ads/stats/summary")
      .then((d) => setSummary(d))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, []);

  const fetchAds = useCallback(
    (p: number = page) => {
      setAdsLoading(true);
      api
        .get<{ items: Ad[]; total: number; page: number; pages: number }>(
          `/admin/ads?page=${p}&per_page=20`
        )
        .then((d) => {
          setAds(Array.isArray(d) ? d : d.items || []);
          setTotalPages(d.pages || 1);
        })
        .catch(() => setAds([]))
        .finally(() => setAdsLoading(false));
    },
    [page]
  );

  useEffect(() => {
    if (!isReady) return;
    fetchSummary();
    fetchAds(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  useEffect(() => {
    if (!isReady) return;
    fetchAds(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, isReady]);

  // ── Form handlers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingAd(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (ad: Ad) => {
    setEditingAd(ad);
    setForm({
      title_en: ad.title_en,
      title_si: ad.title_si || "",
      description_en: ad.description_en || "",
      description_si: ad.description_si || "",
      click_url: ad.click_url || "",
      target_roles: ad.target_roles || [],
      target_districts: ad.target_districts?.length
        ? ad.target_districts.join(", ")
        : "All",
      starts_at: ad.starts_at ? ad.starts_at.split("T")[0] : todayStr(),
      ends_at: ad.ends_at ? ad.ends_at.split("T")[0] : "",
      display_order: ad.display_order || 0,
      advertiser_name: ad.advertiser_name || "",
      advertiser_contact: ad.advertiser_contact || "",
    });
    setImageFile(null);
    setImagePreview(ad.image_url || null);
    setFormError("");
    setShowForm(true);
  };

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageChange(file);
    }
  };

  const validateForm = (): string | null => {
    if (!form.title_en.trim()) return "Title (EN) is required.";
    if (
      form.click_url &&
      !/^https?:\/\/.+/.test(form.click_url)
    )
      return "Click URL must start with http:// or https://";
    return null;
  };

  const submitForm = async () => {
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setFormSaving(true);
    setFormError("");

    try {
      const districts =
        form.target_districts.trim().toLowerCase() === "all" || !form.target_districts.trim()
          ? []
          : form.target_districts.split(",").map((s) => s.trim()).filter(Boolean);

      if (editingAd) {
        // Update existing ad
        await api.patch(`/admin/ads/${editingAd.id}`, {
          title_en: form.title_en,
          title_si: form.title_si || null,
          description_en: form.description_en || null,
          description_si: form.description_si || null,
          click_url: form.click_url || null,
          target_roles: form.target_roles,
          target_districts: districts,
          starts_at: form.starts_at,
          ends_at: form.ends_at || null,
          display_order: form.display_order,
          advertiser_name: form.advertiser_name || null,
          advertiser_contact: form.advertiser_contact || null,
        });

        // Upload new image if selected
        if (imageFile) {
          const fd = new FormData();
          fd.append("file", imageFile);
          await fetch(`/api/v1/admin/ads/${editingAd.id}/image`, {
            method: "POST",
            body: fd,
          });
        }
      } else {
        // Create new ad using multipart form data
        const fd = new FormData();
        fd.append("title_en", form.title_en);
        if (form.title_si) fd.append("title_si", form.title_si);
        if (form.description_en) fd.append("description_en", form.description_en);
        if (form.description_si) fd.append("description_si", form.description_si);
        if (form.click_url) fd.append("click_url", form.click_url);
        form.target_roles.forEach((r) => fd.append("target_roles", r));
        districts.forEach((d) => fd.append("target_districts", d));
        fd.append("starts_at", form.starts_at);
        if (form.ends_at) fd.append("ends_at", form.ends_at);
        fd.append("display_order", String(form.display_order));
        if (form.advertiser_name) fd.append("advertiser_name", form.advertiser_name);
        if (form.advertiser_contact) fd.append("advertiser_contact", form.advertiser_contact);
        if (imageFile) fd.append("file", imageFile);

        await fetch("/api/v1/admin/ads", {
          method: "POST",
          body: fd,
        });
      }

      setShowForm(false);
      fetchAds(page);
      fetchSummary();
    } catch {
      setFormError("Failed to save advertisement. Please try again.");
    } finally {
      setFormSaving(false);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const openStats = (ad: Ad) => {
    setStatsAd(ad);
    setStatsLoading(true);
    api
      .get<AdStats>(`/admin/ads/${ad.id}/stats`)
      .then((d) => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  };

  // ── Pause / Activate ──────────────────────────────────────────────────────

  const toggleActive = async (ad: Ad) => {
    try {
      await api.patch(`/admin/ads/${ad.id}`, { is_active: !ad.is_active });
      fetchAds(page);
      fetchSummary();
    } catch {
      // silent
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteAd) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/ads/${deleteAd.id}`);
      setDeleteAd(null);
      fetchAds(page);
      fetchSummary();
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Advertisements</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage banner ads shown across the platform
          </p>
        </div>
        <button
          data-testid="new-ad-button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Ad
        </button>
      </div>

      {/* A) Summary Stats */}
      <div data-testid="ad-summary" className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {summaryLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-7 w-16" />
            </Card>
          ))
        ) : summary ? (
          <>
            <Card className="p-4">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Total Ads</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{formatNumber(summary.total_ads)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Active</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatNumber(summary.active_ads)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Impressions</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{formatNumber(summary.total_impressions)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Clicks</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{formatNumber(summary.total_clicks)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">CTR</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{(summary.overall_ctr * 100).toFixed(2)}%</p>
            </Card>
          </>
        ) : (
          <Card className="col-span-full p-4 text-center text-neutral-400">
            Could not load summary stats.
          </Card>
        )}
      </div>

      {/* B) Ad List */}
      <div className="space-y-3">
        {adsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex gap-4">
                <Skeleton className="w-24 h-16 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            </Card>
          ))
        ) : ads.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-neutral-400">No advertisements found.</p>
            <button onClick={openCreate} className="mt-3 text-primary-600 text-sm font-medium hover:underline">
              Create your first ad
            </button>
          </Card>
        ) : (
          ads.map((ad) => {
            const status = getAdStatus(ad);
            return (
              <Card key={ad.id} data-testid="ad-card" className="p-4">
                <div className="flex gap-4 flex-col sm:flex-row">
                  {/* Thumbnail */}
                  <div className="w-full sm:w-28 h-20 bg-neutral-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                    {ad.image_url ? (
                      <img
                        src={ad.image_url}
                        alt={ad.title_en}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg className="w-8 h-8 text-neutral-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-neutral-900 truncate">{ad.title_en}</h3>
                        {ad.advertiser_name && (
                          <p className="text-xs text-neutral-500 mt-0.5">by {ad.advertiser_name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`w-2 h-2 rounded-full ${status.color}`} />
                        <span className="text-xs font-medium text-neutral-600">{status.label}</span>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-neutral-500">
                      <span>
                        Roles: {ad.target_roles?.length ? ad.target_roles.map((r) => ROLE_LABELS[r] || r).join(", ") : "All"}
                      </span>
                      <span>
                        Districts: {ad.target_districts?.length ? ad.target_districts.join(", ") : "All"}
                      </span>
                      <span>
                        {formatDate(ad.starts_at)} - {formatDate(ad.ends_at)}
                      </span>
                    </div>

                    {/* Metrics row */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs">
                      <span className="text-neutral-600">
                        <span className="font-medium">{formatNumber(ad.impressions)}</span> impressions
                      </span>
                      <span className="text-neutral-600">
                        <span className="font-medium">{formatNumber(ad.clicks)}</span> clicks
                      </span>
                      <span className="text-amber-600 font-medium">
                        {(ad.ctr * 100).toFixed(2)}% CTR
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(ad)}
                      className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      data-testid="ad-stats-button"
                      onClick={() => openStats(ad)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Stats
                    </button>
                    <button
                      onClick={() => toggleActive(ad)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        ad.is_active
                          ? "text-yellow-700 bg-yellow-50 hover:bg-yellow-100"
                          : "text-green-700 bg-green-50 hover:bg-green-100"
                      }`}
                    >
                      {ad.is_active ? "Pause" : "Activate"}
                    </button>
                    <button
                      onClick={() => setDeleteAd(ad)}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 disabled:opacity-40 hover:bg-neutral-50 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 disabled:opacity-40 hover:bg-neutral-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* ── C) Create/Edit Modal ──────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => !formSaving && setShowForm(false)} />
          <div
            data-testid="ad-form-modal"
            className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-xl mx-4"
          >
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900">
                {editingAd ? "Edit Advertisement" : "New Advertisement"}
              </h2>
              <button
                data-testid="ad-form-cancel"
                onClick={() => !formSaving && setShowForm(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Banner Image</label>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-300 rounded-xl p-4 text-center cursor-pointer hover:border-primary-400 transition-colors"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
                  ) : (
                    <div className="py-4">
                      <svg className="w-10 h-10 mx-auto text-neutral-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-sm text-neutral-500 mt-2">
                        Drag & drop an image, or <span className="text-primary-600 font-medium">click to browse</span>
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              {/* Title EN */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Title (EN) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title_en}
                  onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Advertisement title in English"
                />
              </div>

              {/* Title SI */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Title (SI)</label>
                <input
                  type="text"
                  value={form.title_si}
                  onChange={(e) => setForm((f) => ({ ...f, title_si: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Advertisement title in Sinhala (optional)"
                />
              </div>

              {/* Description EN */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Description (EN)</label>
                <textarea
                  value={form.description_en}
                  onChange={(e) => setForm((f) => ({ ...f, description_en: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  placeholder="Short description (optional)"
                />
              </div>

              {/* Description SI */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Description (SI)</label>
                <textarea
                  value={form.description_si}
                  onChange={(e) => setForm((f) => ({ ...f, description_si: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  placeholder="Short description in Sinhala (optional)"
                />
              </div>

              {/* Click URL */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Click URL</label>
                <input
                  type="url"
                  value={form.click_url}
                  onChange={(e) => setForm((f) => ({ ...f, click_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="https://example.com (optional)"
                />
              </div>

              {/* Target Roles */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Target Roles</label>
                <div className="flex flex-wrap gap-3">
                  {ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.target_roles.includes(role)}
                        onChange={(e) => {
                          setForm((f) => ({
                            ...f,
                            target_roles: e.target.checked
                              ? [...f.target_roles, role]
                              : f.target_roles.filter((r) => r !== role),
                          }));
                        }}
                        className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-neutral-700">{ROLE_LABELS[role]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Target Districts */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Target Districts</label>
                <input
                  type="text"
                  value={form.target_districts}
                  onChange={(e) => setForm((f) => ({ ...f, target_districts: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder='Comma-separated, or "All"'
                />
              </div>

              {/* Dates row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.starts_at}
                    onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.ends_at}
                    onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Display order */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                  className="w-32 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Advertiser info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Advertiser Name</label>
                  <input
                    type="text"
                    value={form.advertiser_name}
                    onChange={(e) => setForm((f) => ({ ...f, advertiser_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Contact</label>
                  <input
                    type="text"
                    value={form.advertiser_contact}
                    onChange={(e) => setForm((f) => ({ ...f, advertiser_contact: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Phone or email (optional)"
                  />
                </div>
              </div>

              {/* Error */}
              {formError && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {formError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-neutral-100 flex justify-end gap-3">
              <button
                data-testid="ad-form-cancel"
                onClick={() => !formSaving && setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
                disabled={formSaving}
              >
                Cancel
              </button>
              <button
                onClick={submitForm}
                disabled={formSaving}
                className="px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {formSaving ? "Saving..." : editingAd ? "Update Ad" : "Create Ad"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── D) Stats Detail Modal ─────────────────────────────────────────── */}
      {statsAd && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setStatsAd(null)} />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-xl mx-4">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Ad Statistics</h2>
                <p className="text-sm text-neutral-500">{statsAd.title_en}</p>
              </div>
              <button
                onClick={() => setStatsAd(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
              {statsLoading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 rounded-xl" />
                    ))}
                  </div>
                  <Skeleton className="h-40 rounded-xl" />
                </div>
              ) : stats ? (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-neutral-50 rounded-xl p-4 text-center">
                      <p className="text-xs text-neutral-500 uppercase">Impressions</p>
                      <p className="text-xl font-bold text-neutral-900 mt-1">{formatNumber(stats.total_impressions)}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-xl p-4 text-center">
                      <p className="text-xs text-neutral-500 uppercase">Clicks</p>
                      <p className="text-xl font-bold text-neutral-900 mt-1">{formatNumber(stats.total_clicks)}</p>
                    </div>
                    <div className="bg-neutral-50 rounded-xl p-4 text-center">
                      <p className="text-xs text-neutral-500 uppercase">CTR</p>
                      <p className="text-xl font-bold text-amber-600 mt-1">{(stats.ctr * 100).toFixed(2)}%</p>
                    </div>
                  </div>

                  {/* By-role breakdown */}
                  {stats.by_role?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-700 mb-2">By Role</h3>
                      <div className="bg-neutral-50 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-neutral-500 uppercase">
                              <th className="text-left px-4 py-2">Role</th>
                              <th className="text-right px-4 py-2">Impressions</th>
                              <th className="text-right px-4 py-2">Clicks</th>
                              <th className="text-right px-4 py-2">CTR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.by_role.map((r) => (
                              <tr key={r.role} className="border-t border-neutral-100">
                                <td className="px-4 py-2 font-medium text-neutral-700 capitalize">{r.role}</td>
                                <td className="px-4 py-2 text-right text-neutral-600">{formatNumber(r.impressions)}</td>
                                <td className="px-4 py-2 text-right text-neutral-600">{formatNumber(r.clicks)}</td>
                                <td className="px-4 py-2 text-right text-amber-600 font-medium">{(r.ctr * 100).toFixed(2)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* By-day bars */}
                  {stats.by_day?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-700 mb-2">Daily Impressions</h3>
                      <div className="space-y-1.5">
                        {(() => {
                          const maxImpr = Math.max(...stats.by_day.map((d) => d.impressions), 1);
                          return stats.by_day.slice(-14).map((d) => (
                            <div key={d.date} className="flex items-center gap-2">
                              <span className="text-xs text-neutral-500 w-20 shrink-0 text-right">
                                {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                              <div className="flex-1 flex items-center gap-1">
                                <div
                                  className="h-5 bg-primary-400 rounded-r"
                                  style={{ width: `${(d.impressions / maxImpr) * 100}%`, minWidth: d.impressions > 0 ? "4px" : "0" }}
                                />
                                <span className="text-xs text-neutral-500">{d.impressions}</span>
                              </div>
                              <span className="text-xs text-blue-500 w-12 text-right">{d.clicks} clk</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Top districts */}
                  {stats.top_districts?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-700 mb-2">Top Districts</h3>
                      <div className="bg-neutral-50 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-neutral-500 uppercase">
                              <th className="text-left px-4 py-2">District</th>
                              <th className="text-right px-4 py-2">Impressions</th>
                              <th className="text-right px-4 py-2">Clicks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.top_districts.map((d) => (
                              <tr key={d.district} className="border-t border-neutral-100">
                                <td className="px-4 py-2 font-medium text-neutral-700">{d.district}</td>
                                <td className="px-4 py-2 text-right text-neutral-600">{formatNumber(d.impressions)}</td>
                                <td className="px-4 py-2 text-right text-neutral-600">{formatNumber(d.clicks)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-neutral-400 py-8">Could not load statistics.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────────────────────── */}
      {deleteAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setDeleteAd(null)} />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-xl mx-4 p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Delete Advertisement</h3>
            <p className="text-sm text-neutral-500 mt-2">
              Are you sure you want to delete &quot;{deleteAd.title_en}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setDeleteAd(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
