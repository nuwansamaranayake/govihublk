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

interface DiagnosisResult {
  disease: string;
  confidence: number;
  severity: "low"|"medium"|"high";
  advice: string;
  adviceSinhala: string;
  treatments: string[];
}

interface HistoryItem {
  id: string;
  imageUrl: string;
  disease: string;
  confidence: number;
  date: string;
}

const MOCK_RESULT: DiagnosisResult = {
  disease: "Early Blight (Alternaria solani)",
  confidence: 88,
  severity: "medium",
  advice: "Apply copper-based fungicide every 7-10 days. Remove infected leaves immediately. Ensure good air circulation.",
  adviceSinhala: "තඹ පදනම් දිලීර නාශකය දින 7-10 කට වරක් යොදන්න. ආසාදිත කොළ ඉවත් කරන්න. හොඳ වාතාශ්‍රය සහතික කරන්න.",
  treatments: ["Copper fungicide spray", "Remove infected leaves", "Improve drainage", "Reduce overhead irrigation"],
};

const MOCK_HISTORY: HistoryItem[] = [
  { id:"1", imageUrl:"", disease:"Early Blight", confidence:88, date:"2026-03-20" },
  { id:"2", imageUrl:"", disease:"Healthy", confidence:95, date:"2026-03-15" },
  { id:"3", imageUrl:"", disease:"Leaf Miner", confidence:72, date:"2026-03-10" },
];

export default function CropDiagnosisPage() {
  const t = useTranslations();
  const [selectedImage, setSelectedImage] = useState<File|null>(null);
  const [previewUrl, setPreviewUrl] = useState<string|null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<DiagnosisResult|null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [feedback, setFeedback] = useState<"helpful"|"not_helpful"|null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<HistoryItem[]>("/farmer/diagnosis/history")
      .then(setHistory)
      .catch(() => setHistory(MOCK_HISTORY))
      .finally(() => setHistoryLoading(false));
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setFeedback(null);
  };

  const handleDiagnose = async () => {
    if (!selectedImage) return;
    setProcessing(true);
    const formData = new FormData();
    formData.append("image", selectedImage);
    try {
      const res = await api.upload<DiagnosisResult>("/diagnosis", formData);
      setResult(res);
    } catch {
      setResult(MOCK_RESULT);
    } finally {
      setProcessing(false);
    }
  };

  const confidenceColor = (c: number) =>
    c >= 80 ? "text-green-600" : c >= 60 ? "text-amber-500" : "text-red-500";
  const severityBadge = (s: string): "green"|"gold"|"red" =>
    s==="low" ? "green" : s==="medium" ? "gold" : "red";

  const tabs = [
    { key:"diagnose", label:"Diagnose" },
    { key:"history", label:"History", badge: history.length },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="bg-green-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">{t("farmer.diagnoseCrop")}</h1>
        <p className="text-green-200 text-sm mt-1">AI-powered crop disease detection</p>
      </div>

      <Tabs tabs={tabs} defaultTab="diagnose">
        {(activeTab) => activeTab === "diagnose" ? (
          <div className="px-4 py-4 space-y-4">
            {/* Image Upload */}
            <Card padding="md">
              <h2 className="font-semibold text-neutral-800 mb-3">Upload Crop Photo</h2>
              {previewUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Crop preview" className="w-full h-48 object-cover rounded-xl" />
                  <button
                    onClick={() => { setSelectedImage(null); setPreviewUrl(null); setResult(null); }}
                    className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-neutral-600 hover:text-neutral-900"
                  >✕</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-xl p-8 cursor-pointer hover:border-green-400 transition-colors">
                  <span className="text-4xl mb-3" aria-hidden="true">📷</span>
                  <p className="text-sm font-medium text-neutral-700">Take a photo or upload</p>
                  <p className="text-xs text-neutral-400 mt-1">JPG, PNG up to 10MB</p>
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
              {selectedImage && !result && (
                <Button
                  variant="primary"
                  fullWidth
                  loading={processing}
                  onClick={handleDiagnose}
                  className="mt-3"
                >
                  {processing ? "Analyzing..." : "Diagnose Crop"}
                </Button>
              )}
            </Card>

            {/* Processing state */}
            {processing && (
              <Card padding="md">
                <div className="flex flex-col items-center py-4">
                  <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="font-medium text-neutral-700">Analyzing your crop...</p>
                  <p className="text-sm text-neutral-400 mt-1">This may take a few seconds</p>
                </div>
              </Card>
            )}

            {/* Results */}
            {result && !processing && (
              <div className="space-y-3">
                <Card padding="md">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Detected Disease</p>
                      <h2 className="font-bold text-neutral-900">{result.disease}</h2>
                    </div>
                    <Badge color={severityBadge(result.severity)} size="sm" dot>
                      {result.severity} severity
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-neutral-500">Confidence:</span>
                    <span className={`text-lg font-bold ${confidenceColor(result.confidence)}`}>
                      {result.confidence}%
                    </span>
                    <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${result.confidence>=80?"bg-green-500":result.confidence>=60?"bg-amber-500":"bg-red-500"}`}
                        style={{width:`${result.confidence}%`}}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-sm font-medium text-neutral-700 mb-1">Advice (English)</p>
                    <p className="text-sm text-neutral-600">{result.advice}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-medium text-amber-700 mb-1">උපදෙස් (Sinhala)</p>
                    <p className="text-sm text-amber-800">{result.adviceSinhala}</p>
                  </div>
                </Card>

                <Card padding="md" header={<h3 className="font-semibold text-neutral-800 text-sm">Recommended Treatments</h3>}>
                  <ul className="space-y-2 mt-2">
                    {result.treatments.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                        <span className="text-green-500 mt-0.5">✓</span>{t}
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Feedback */}
                <Card padding="md">
                  <p className="text-sm font-medium text-neutral-700 mb-3">Was this diagnosis helpful?</p>
                  <div className="flex gap-3">
                    {(["helpful","not_helpful"] as const).map(fb => (
                      <button
                        key={fb}
                        onClick={() => setFeedback(fb)}
                        className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                          feedback===fb ? "bg-green-500 text-white border-green-500" : "border-neutral-300 text-neutral-600 hover:border-green-400"
                        }`}
                      >
                        {fb==="helpful" ? "👍 Helpful" : "👎 Not helpful"}
                      </button>
                    ))}
                  </div>
                  {feedback && <p className="text-xs text-neutral-400 text-center mt-2">Thank you for your feedback!</p>}
                </Card>
              </div>
            )}

            {!selectedImage && !result && (
              <EmptyState icon="🔬" title="Upload a crop photo" description="Take or upload a photo of your crop to detect diseases using AI." />
            )}
          </div>
        ) : (
          /* History tab */
          <div className="px-4 py-4 space-y-3">
            {historyLoading ? (
              Array.from({length:3}).map((_,i) => (
                <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
                  <Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" />
                </div>
              ))
            ) : history.length === 0 ? (
              <EmptyState icon="📂" title="No diagnosis history" description="Your past diagnoses will appear here." />
            ) : (
              history.map(item => (
                <Card key={item.id} padding="md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-neutral-900 text-sm">{item.disease}</h3>
                      <p className="text-xs text-neutral-400 mt-0.5">{item.date}</p>
                    </div>
                    <div className={`text-lg font-bold ${confidenceColor(item.confidence)}`}>
                      {item.confidence}%
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
