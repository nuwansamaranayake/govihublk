"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth } from "@/lib/auth";

interface DiagnosisResult {
  id: string;
  disease_name: string;
  confidence: number;
  crop_detected: string;
  description: string;
  treatment: string;
  prevention: string;
  severity: "mild" | "moderate" | "severe";
  advice_sinhala: string;
  consult_expert: boolean;
  image_url: string;
  status: string;
  created_at: string;
}

interface HistoryItem {
  id: string;
  imageUrl: string;
  disease: string;
  confidence: number;
  date: string;
}

const CROP_OPTIONS = [
  { value: "", labelKey: "selectCrop" },
  { value: "Rice", labelKey: "cropRice" },
  { value: "Tomato", labelKey: "cropTomato" },
  { value: "Chili", labelKey: "cropChili" },
  { value: "Onion", labelKey: "cropOnion" },
  { value: "Beans", labelKey: "cropBeans" },
  { value: "Brinjal", labelKey: "cropBrinjal" },
  { value: "Other", labelKey: "cropOther" },
];

export default function CropDiagnosisPage() {
  const t = useTranslations();
  const { isReady } = useAuth();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"helpful" | "not_helpful" | null>(null);
  const [cropType, setCropType] = useState("");
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isReady) return;
    api.get<any>("/diagnosis/history")
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];
        setHistory(items);
      })
      .catch((err: any) => {
        setHistoryError(err?.message || "Failed to load diagnosis history");
        setHistory([]);
      })
      .finally(() => setHistoryLoading(false));
  }, [isReady]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setFeedback(null);
    setDiagnosisError(null);
  };

  const handleDiagnose = async () => {
    if (!selectedImage) return;
    setProcessing(true);
    setDiagnosisError(null);
    const formData = new FormData();
    formData.append("image", selectedImage);
    if (cropType) formData.append("crop_type", cropType);
    try {
      const res = await api.upload<DiagnosisResult>("/diagnosis/upload", formData);
      setResult(res);
    } catch (err: any) {
      setDiagnosisError(err?.message || "Diagnosis failed");
    } finally {
      setProcessing(false);
    }
  };

  const confidencePct = (c: number) => Math.round(c * 100);

  const confidenceBadge = (c: number) => {
    const pct = confidencePct(c);
    if (pct >= 70) return { color: "green" as const, label: t("diagnosis.highConfidence") };
    if (pct >= 40) return { color: "gold" as const, label: t("diagnosis.mediumConfidence") };
    return { color: "red" as const, label: t("diagnosis.lowConfidence") };
  };

  const severityBadge = (s: string): { color: "green" | "gold" | "red"; label: string } => {
    if (s === "mild") return { color: "green", label: t("diagnosis.mild") };
    if (s === "moderate") return { color: "gold", label: t("diagnosis.moderate") };
    return { color: "red", label: t("diagnosis.severe") };
  };

  const confidenceColor = (c: number) => {
    const pct = typeof c === "number" && c <= 1 ? Math.round(c * 100) : c;
    return pct >= 70 ? "text-green-600" : pct >= 40 ? "text-amber-500" : "text-red-500";
  };

  const confidenceBarColor = (c: number) => {
    const pct = typeof c === "number" && c <= 1 ? Math.round(c * 100) : c;
    return pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  };

  /** Split treatment/prevention text into steps */
  const splitSteps = (text: string): string[] => {
    if (!text) return [];
    // Split on numbered patterns like "1. ", "2. " or newlines
    const lines = text.split(/(?:\r?\n)+|(?<=\.)\s+(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean);
    return lines;
  };

  const tabs = [
    { key: "diagnose", label: t("diagnosis.diagnose") },
    { key: "history", label: t("diagnosis.history"), badge: history.length },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-green-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("farmer.diagnoseCrop")}</h1>
        <p className="text-green-200 text-sm mt-1">{t("diagnosis.subtitle")}</p>
      </div>

      <Tabs tabs={tabs} defaultTab="diagnose">
        {(activeTab) => activeTab === "diagnose" ? (
          <div className="px-4 py-4 space-y-4">
            {/* Image Upload */}
            <Card padding="md">
              <h2 className="font-semibold text-neutral-800 mb-3">{t("diagnosis.uploadCropPhoto")}</h2>
              {previewUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Crop preview" className="w-full h-48 object-cover rounded-xl" />
                  <button
                    onClick={() => { setSelectedImage(null); setPreviewUrl(null); setResult(null); setCropType(""); setDiagnosisError(null); }}
                    className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-neutral-600 hover:text-neutral-900"
                  >✕</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-xl p-8 cursor-pointer hover:border-green-400 transition-colors">
                  <span className="text-4xl mb-3" aria-hidden="true">📷</span>
                  <p className="text-sm font-medium text-neutral-700">{t("diagnosis.takePhotoOrUpload")}</p>
                  <p className="text-xs text-neutral-400 mt-1">{t("diagnosis.fileFormats")}</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
                    className="sr-only"
                  />
                </label>
              )}

              {/* Crop type selector */}
              {selectedImage && !result && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t("diagnosis.whatCrop")}
                  </label>
                  <select
                    value={cropType}
                    onChange={(e) => setCropType(e.target.value)}
                    className="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm text-neutral-800 bg-white focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none"
                  >
                    {CROP_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(`diagnosis.${opt.labelKey}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedImage && !result && (
                <Button
                  variant="primary"
                  fullWidth
                  loading={processing}
                  onClick={handleDiagnose}
                  className="mt-3"
                >
                  {processing ? t("diagnosis.analyzing") : t("diagnosis.diagnoseCrop")}
                </Button>
              )}
            </Card>

            {/* Processing state */}
            {processing && (
              <Card padding="md">
                <div className="flex flex-col items-center py-4">
                  <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="font-medium text-neutral-700">{t("diagnosis.analyzingCrop")}</p>
                  <p className="text-sm text-neutral-400 mt-1">{t("diagnosis.mayTakeFewSeconds")}</p>
                </div>
              </Card>
            )}

            {/* Error */}
            {diagnosisError && !processing && (
              <Card padding="md">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <p className="text-sm text-red-700">{diagnosisError}</p>
                </div>
              </Card>
            )}

            {/* Results */}
            {result && !processing && (
              <div className="space-y-3">

                {/* Consult expert warning */}
                {result.consult_expert && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                    <p className="text-sm font-medium text-amber-800">
                      ⚠️ {t("diagnosis.consultExpert")}
                    </p>
                  </div>
                )}

                {/* Primary Sinhala advice card */}
                <div className="bg-green-50 border-2 border-green-700 rounded-xl p-4">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">උපදෙස් / {t("diagnosis.adviceSinhala")}</p>
                  <p className="text-base text-green-900 leading-relaxed" style={{ fontSize: "16px" }}>
                    {result.advice_sinhala}
                  </p>
                </div>

                {/* Confidence indicator */}
                <div className="flex items-center gap-3">
                  <Badge color={confidenceBadge(result.confidence).color} size="sm">
                    {confidenceBadge(result.confidence).label}
                  </Badge>
                  <span className={`text-lg font-bold ${confidenceColor(result.confidence)}`}>
                    {confidencePct(result.confidence)}%
                  </span>
                  <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${confidenceBarColor(result.confidence)}`}
                      style={{ width: `${confidencePct(result.confidence)}%` }}
                    />
                  </div>
                </div>

                {/* Crop detected + Disease + Severity */}
                <Card padding="md">
                  {result.crop_detected && (
                    <div className="mb-2">
                      <p className="text-xs text-neutral-400 uppercase tracking-wide">{t("diagnosis.cropDetected")}</p>
                      <p className="text-sm font-semibold text-neutral-800">{result.crop_detected}</p>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">{t("diagnosis.detectedDisease")}</p>
                      <h2 className="font-bold text-neutral-900">{result.disease_name}</h2>
                    </div>
                    <Badge color={severityBadge(result.severity).color} size="sm" dot>
                      {severityBadge(result.severity).label}
                    </Badge>
                  </div>
                </Card>

                {/* Treatment steps */}
                {result.treatment && (
                  <Card padding="md" header={<h3 className="font-semibold text-neutral-800 text-sm">{t("diagnosis.treatment")}</h3>}>
                    <ol className="space-y-2 mt-2 list-none">
                      {splitSteps(result.treatment).map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </Card>
                )}

                {/* Prevention — blue info card */}
                {result.prevention && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="font-semibold text-blue-800 text-sm mb-2">{t("diagnosis.prevention")}</h3>
                    <p className="text-sm text-blue-700 leading-relaxed">{result.prevention}</p>
                  </div>
                )}

                {/* English description — secondary info */}
                {result.description && (
                  <Card padding="md">
                    <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">{t("diagnosis.adviceEnglish")}</p>
                    <p className="text-sm text-neutral-600 leading-relaxed">{result.description}</p>
                  </Card>
                )}

                {/* Feedback */}
                <Card padding="md">
                  <p className="text-sm font-medium text-neutral-700 mb-3">{t("diagnosis.wasHelpful")}</p>
                  <div className="flex gap-3">
                    {(["helpful", "not_helpful"] as const).map(fb => (
                      <button
                        key={fb}
                        onClick={() => setFeedback(fb)}
                        className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                          feedback === fb ? "bg-green-500 text-white border-green-500" : "border-neutral-300 text-neutral-600 hover:border-green-400"
                        }`}
                      >
                        {fb === "helpful" ? `👍 ${t("diagnosis.helpful")}` : `👎 ${t("diagnosis.notHelpful")}`}
                      </button>
                    ))}
                  </div>
                  {feedback && <p className="text-xs text-neutral-400 text-center mt-2">{t("diagnosis.thankYouFeedback")}</p>}
                </Card>
              </div>
            )}

            {!selectedImage && !result && (
              <EmptyState icon="🔬" title={t("diagnosis.uploadAPhoto")} description={t("diagnosis.uploadDescription")} />
            )}
          </div>
        ) : (
          /* History tab */
          <div className="px-4 py-4 space-y-3">
            {historyLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                  <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" />
                </div>
              ))
            ) : history.length === 0 ? (
              <EmptyState icon="📂" title={t("diagnosis.noHistory")} description={t("diagnosis.noHistoryDesc")} />
            ) : (
              history.map(item => (
                <Card key={item.id} padding="md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-neutral-900 text-sm">{item.disease}</h3>
                      <p className="text-xs text-neutral-400 mt-0.5">{item.date}</p>
                    </div>
                    <div className={`text-lg font-bold ${confidenceColor(item.confidence)}`}>
                      {typeof item.confidence === "number" && item.confidence <= 1
                        ? `${Math.round(item.confidence * 100)}%`
                        : `${item.confidence}%`}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </Tabs>
    </div>
  );
}
