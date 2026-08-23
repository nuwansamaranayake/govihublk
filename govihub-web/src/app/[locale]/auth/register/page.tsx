"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import TopBar from "@/components/ui/TopBar";
import { PhoneInput, isValidE164Phone } from "@/components/ui/PhoneInput";
import { api, ApiException } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** True when a 422 body carries the backend's TOS_NOT_ACCEPTED field error. */
function isTosNotAccepted(details: unknown): boolean {
  const detail = (details as { detail?: unknown } | null)?.detail;
  return (
    Array.isArray(detail) &&
    detail.some((d) => (d as { code?: string })?.code === "TOS_NOT_ACCEPTED")
  );
}

/**
 * Backend 409 conflict codes -> `auth.*` i18n keys. The body shape is
 * {detail: {code, message}}; without this the raw English `message` would leak
 * into a Sinhala or Tamil session. Unmapped codes fall through to the generic
 * message, which carries the code so support can trace it.
 */
const CONFLICT_KEYS: Record<string, string> = {
  DUPLICATE_PHONE: "auth.phone_already_registered",
  USERNAME_TAKEN: "auth.username_taken",
  // This wizard identifies the user by their Google email, so a duplicate
  // role account here really is a duplicate email.
  ROLE_ACCOUNT_EXISTS: "auth.email_already_registered",
  MAX_ACCOUNTS: "auth.auth_error_max_accounts",
};

/** The `{code, message}` object from a 409 body, or null for any other shape. */
function conflictCode(details: unknown): string | undefined {
  const detail = (details as { detail?: unknown } | null)?.detail;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return undefined;
  return (detail as { code?: string }).code;
}

type Role = "farmer" | "buyer" | "supplier";

const ROLES: { key: Role; label: string; emoji: string; desc: string }[] = [
  {
    key: "farmer",
    label: "Farmer",
    emoji: "🌾",
    desc: "List harvests & get AI-matched buyers",
  },
  {
    key: "buyer",
    label: "Buyer",
    emoji: "🛒",
    desc: "Post demands & connect with farmers",
  },
  {
    key: "supplier",
    label: "Supplier",
    emoji: "🏭",
    desc: "Supply agricultural inputs & services",
  },
];

const DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo",
  "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara",
  "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar",
  "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya",
  "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya",
].map((d) => ({ value: d.toLowerCase().replace(/\s+/g, "_"), label: d }));

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "si", label: "Sinhala" },
  { value: "ta", label: "Tamil" },
];

interface FormData {
  name: string;
  phone: string;
  district: string;
  language: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  district?: string;
}

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { updateUser } = useAuth();

  const [step, setStep] = useState<"role" | "profile">("role");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [form, setForm] = useState<FormData>({
    name: "",
    phone: "",
    district: "",
    language: locale,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      errs.name = "Full name must be at least 2 characters";
    if (!isValidE164Phone(form.phone))
      errs.phone = t("auth.phone_invalid");
    if (!form.district) errs.district = "Please select your district";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleRoleNext = () => {
    if (selectedRole) setStep("profile");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setServerError(null);
    try {
      const data = await api.post<{ role: string; name: string }>(
        "/users/complete-registration",
        {
          role: selectedRole,
          name: form.name.trim(),
          phone: form.phone.trim(),
          district: form.district,
          language: form.language,
          tos_accepted: true,
        }
      );
      updateUser({ role: data.role as Role, name: data.name, isProfileComplete: true });
      // Farmers go to crop selection first, others straight to dashboard
      if (selectedRole === "farmer") {
        router.replace("/" + locale + "/auth/select-crops");
      } else {
        router.replace("/" + locale + "/" + selectedRole + "/dashboard");
      }
    } catch (err: unknown) {
      // The backend rejects a missing/false tos_accepted with a 422 whose
      // detail entries carry `code` but no `msg`, so ApiException.message ends
      // up useless here — read the code off `details` and localize it instead.
      if (err instanceof ApiException && isTosNotAccepted(err.details)) {
        setServerError(t("auth.auth_error_tos_not_accepted"));
        return;
      }
      // Duplicate phone / username / role-account come back as a 409 whose
      // `message` is English-only. Localize it rather than showing it raw.
      if (err instanceof ApiException && err.status === 409) {
        const code = conflictCode(err.details);
        const key = code ? CONFLICT_KEYS[code] : undefined;
        setServerError(
          key ? t(key) : t("auth.auth_error_generic", { code: code ?? String(err.status) }),
        );
        return;
      }
      const message =
        err instanceof Error ? err.message : "Registration failed. Please try again.";
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "role") {
    return (
      <div className="min-h-dvh flex flex-col bg-neutral-50">
        <TopBar title={t("auth.register")} showBack />
        <div className="flex-1 px-4 py-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-neutral-900">
              {t("auth.selectRole")}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">Choose how you use GoviHub</p>
          </div>

          <div className="space-y-3">
            {ROLES.map((role) => (
              <button
                key={role.key}
                onClick={() => setSelectedRole(role.key)}
                className={[
                  "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all",
                  selectedRole === role.key
                    ? "border-primary-500 bg-primary-50"
                    : "border-neutral-200 bg-white hover:border-neutral-300",
                ].join(" ")}
              >
                <span className="text-3xl" role="img" aria-label={role.label}>
                  {role.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-neutral-900">{role.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{role.desc}</p>
                </div>
                {selectedRole === role.key && (
                  <span className="ml-auto shrink-0 text-primary-500">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-8">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={!selectedRole}
              onClick={handleRoleNext}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-neutral-50">
      <TopBar title="Complete Profile" showBack onBack={() => setStep("role")} />
      <form onSubmit={handleSubmit} className="flex-1 px-4 py-6 space-y-5" noValidate>
        <div className="mb-2">
          <p className="text-sm text-neutral-500">
            Registering as{" "}
            <span className="font-semibold text-primary-600 capitalize">{selectedRole}</span>
          </p>
        </div>

        <Input
          label="Full Name"
          required
          placeholder="e.g. Kamal Perera"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
        />

        <PhoneInput
          label={t("auth.phone_label")}
          required
          value={form.phone}
          onChange={(v) => setForm({ ...form, phone: v })}
          defaultCountry="LK"
          error={errors.phone}
          helperText={t("auth.phone_required_explanation")}
        />

        <Select
          label="District"
          required
          placeholder="Select your district"
          options={DISTRICTS}
          value={form.district}
          onChange={(e) => setForm({ ...form, district: e.target.value })}
          error={errors.district}
        />

        <Select
          label="Preferred Language"
          options={LANGUAGES}
          value={form.language}
          onChange={(e) => setForm({ ...form, language: e.target.value })}
        />

        {/* Terms of Use acceptance */}
        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-neutral-300 text-primary-600 focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700">{t("auth.tos_checkbox")}</span>
          </label>
          {/* New tab — a same-tab navigation would discard the filled form. */}
          <a
            href={`/${locale}/terms`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 ml-8 inline-block text-sm text-primary-600 font-medium hover:underline"
          >
            {t("tos.title")}
          </a>
        </div>

        {serverError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
          disabled={isSubmitting || !isValidE164Phone(form.phone) || !tosAccepted}
        >
          {t("common.submit")}
        </Button>
      </form>
    </div>
  );
}
