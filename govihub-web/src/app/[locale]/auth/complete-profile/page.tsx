"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { PhoneInput, isValidE164Phone } from "@/components/ui/PhoneInput";
import { api, ApiException } from "@/lib/api";

export default function CompleteProfilePage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidE164Phone(phone)) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/users/me/complete-profile", { phone });
      let resume: string | null = null;
      if (typeof window !== "undefined") {
        resume = sessionStorage.getItem("resumeAfterProfile");
        sessionStorage.removeItem("resumeAfterProfile");
      }
      router.replace(resume || `/${locale}/farmer/dashboard`);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiException ? err.message :
        err instanceof Error ? err.message :
        "Failed to save phone";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-neutral-50 p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl shadow-sm">
        <div className="text-center mb-6">
          <Image
            src="/images/logo-icon.png"
            alt="GoviHub"
            width={64}
            height={64}
            className="rounded-2xl mx-auto mb-3"
          />
          <h1 className="text-xl font-bold text-neutral-900">{t("complete_your_profile")}</h1>
          <p className="text-sm text-neutral-600 mt-2">{t("phone_required_explanation")}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <PhoneInput
          label={t("phone_label")}
          required
          value={phone}
          onChange={setPhone}
          defaultCountry="LK"
          error={phone && !isValidE164Phone(phone) ? t("phone_invalid") : undefined}
        />

        <button
          type="submit"
          disabled={saving || !isValidE164Phone(phone)}
          className="mt-6 w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t("saving") : t("save_and_continue")}
        </button>
      </form>
    </div>
  );
}
