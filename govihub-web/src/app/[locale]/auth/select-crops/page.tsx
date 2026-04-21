"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/Skeleton";

interface AvailableCrop {
  crop_type: string;
  name_si: string;
  name_en: string;
  selected: boolean;
}

const CROP_ICONS: Record<string, string> = {
  black_pepper: "🌶",
  cinnamon: "🌿",
  turmeric: "🟡",
  ginger: "🫚",
  cloves: "🌸",
  nutmeg: "🥜",
  cardamom: "💚",
  mixed_spices: "🌿",
};

export default function SelectCropsPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const { isReady } = useAuth();
  const [crops, setCrops] = useState<AvailableCrop[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    // Check if farmer already has crops — if so, skip to dashboard
    api
      .get<{ crops: AvailableCrop[] }>("/users/me/crops/available")
      .then((res) => {
        const existing = res.crops.filter((c) => c.selected);
        if (existing.length > 0) {
          router.replace(`/${locale}/farmer/dashboard`);
          return;
        }
        setCrops(res.crops);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isReady]);

  const toggleCrop = (cropType: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cropType)) {
        next.delete(cropType);
      } else if (next.size < 5) {
        next.add(cropType);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const cropTypes = Array.from(selected);
      for (let i = 0; i < cropTypes.length; i++) {
        await api.post("/users/me/crops", { crop_type: cropTypes[i] });
      }
      router.push(`/${locale}/farmer/dashboard`);
    } catch {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.push(`/${locale}/farmer/dashboard`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Skeleton className="h-40 w-72" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-4xl mb-3">🌿</p>
          <h1 className="text-xl font-bold text-neutral-800">
            {t("crops.welcome")}
          </h1>
          <p className="text-sm text-neutral-500 mt-2">
            {t("crops.selectCrops")}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {locale === "si" ? "1-5 බෝග තෝරන්න" : "Select 1-5 crops"}
          </p>
        </div>

        {/* Crop Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {crops.map((crop) => {
            const isSelected = selected.has(crop.crop_type);
            return (
              <button
                key={crop.crop_type}
                onClick={() => toggleCrop(crop.crop_type)}
                className={`relative rounded-2xl border-2 p-4 text-center transition-all ${
                  isSelected
                    ? "border-green-500 bg-green-50 shadow-md"
                    : "border-neutral-200 bg-white hover:border-green-300"
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    ✓
                  </span>
                )}
                <p className="text-3xl mb-2">{CROP_ICONS[crop.crop_type] || "🌱"}</p>
                <p className="text-sm font-semibold text-neutral-800">
                  {locale === "si" ? crop.name_si : crop.name_en}
                </p>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  {locale === "si" ? crop.name_en : crop.name_si}
                </p>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleSave}
            disabled={selected.size === 0 || saving}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
              selected.size > 0
                ? "bg-green-600 text-white hover:bg-green-700 shadow-lg"
                : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            }`}
          >
            {saving
              ? locale === "si" ? "සුරකිමින්..." : "Saving..."
              : `${t("crops.continue")} (${selected.size})`}
          </button>
          <button
            onClick={handleSkip}
            className="w-full py-3 rounded-xl text-sm font-medium text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            {t("crops.selectLater")}
          </button>
        </div>
      </div>
    </div>
  );
}
