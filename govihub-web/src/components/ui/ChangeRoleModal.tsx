"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface ChangeRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: string;
  locale: string;
}

// NEXT_PUBLIC_API_URL already includes the /api/v1 prefix in every environment
// (see docker-compose.spices.yml and lib/api.ts). The previous code appended a
// SECOND /api/v1 here, which produced /api/v1/api/v1/... -> 404 "Not Found".
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api/v1";

interface Eligibility {
  eligible: boolean;
  active_matches: number;
  cooldown_ends_at: string | null;
  reason: string | null;
}

const ROLES = [
  { key: "farmer", icon: "🌾", color: "green" },
  { key: "buyer", icon: "🛒", color: "amber" },
  { key: "supplier", icon: "📦", color: "blue" },
] as const;

// Prefer the backend's structured message ({error:{message}}), then a raw detail,
// then a status fallback. NEVER surface a bare "Not Found" to the user.
function serverMessage(data: any, status: number, fallback: string): string {
  return data?.error?.message || (typeof data?.detail === "string" ? data.detail : null) || `${fallback} (${status})`;
}

export function ChangeRoleModal({ isOpen, onClose, currentRole, locale }: ChangeRoleModalProps) {
  const t = useTranslations("more");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [eligLoading, setEligLoading] = useState(false);

  // Pre-check eligibility when the modal opens so the user sees any block
  // (active matches / cooldown) BEFORE tapping confirm — no dead-end errors.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setEligibility(null);
    setError(null);
    setSelectedRole(null);
    setEligLoading(true);
    (async () => {
      try {
        const token = sessionStorage.getItem("govihub_token");
        const res = await fetch(`${API_BASE}/users/me/role-change-eligibility`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (res.ok) {
          const data = (await res.json()) as Eligibility;
          if (!cancelled) setEligibility(data);
        }
      } catch {
        // Non-fatal: confirm() will surface any real error with a human message.
      } finally {
        if (!cancelled) setEligLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const blocked = eligibility !== null && !eligibility.eligible;

  const blockedMessage = (): string => {
    if (!eligibility) return "";
    if (eligibility.reason === "cooldown") {
      const date = eligibility.cooldown_ends_at
        ? new Date(eligibility.cooldown_ends_at).toLocaleDateString(locale)
        : "";
      return t("blockedCooldown", { date });
    }
    if (eligibility.reason === "active_matches") {
      return t("blockedActiveMatches", { count: eligibility.active_matches });
    }
    return t("blockedGeneric");
  };

  const handleConfirm = async () => {
    if (!selectedRole || selectedRole === currentRole || blocked) return;

    setLoading(true);
    setError(null);

    try {
      const token = sessionStorage.getItem("govihub_token");
      const res = await fetch(`${API_BASE}/users/me/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ new_role: selectedRole }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(serverMessage(data, res.status, t("changeRoleFailed")));
      }

      // Success: swap in the fresh access token (it carries the NEW role claim) so
      // the new-role dashboard authorises the very next request.
      if (data?.access_token) {
        sessionStorage.setItem("govihub_token", data.access_token);
        document.cookie = "govihub_token=" + data.access_token + ";path=/;max-age=86400";
      }

      window.location.href = `/${locale}/${selectedRole}/dashboard`;
    } catch (err: any) {
      setError(err.message || t("changeRoleFailed"));
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setSelectedRole(null);
    setError(null);
    onClose();
  };

  const roleDescKey = (role: string) => {
    switch (role) {
      case "farmer": return t("roleDescFarmer");
      case "buyer": return t("roleDescBuyer");
      case "supplier": return t("roleDescSupplier");
      default: return "";
    }
  };

  const roleName = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal card */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold text-neutral-900">{t("changeRoleTitle")}</h2>
        </div>

        {/* Blocked banner (active matches / cooldown) */}
        {blocked && (
          <div className="px-5 mb-1">
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 leading-relaxed">
              {blockedMessage()}
            </p>
          </div>
        )}

        {/* Role cards */}
        <div className="px-5 space-y-2.5">
          {ROLES.map((role) => {
            const isCurrent = role.key === currentRole;
            const isSelected = role.key === selectedRole;
            const disabled = isCurrent || loading || blocked || eligLoading;

            return (
              <button
                key={role.key}
                disabled={disabled}
                onClick={() => setSelectedRole(role.key)}
                className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border-2 transition-all text-left ${
                  isCurrent
                    ? "border-neutral-200 bg-neutral-50 opacity-60 cursor-not-allowed"
                    : isSelected
                    ? "border-green-500 bg-green-50 shadow-sm"
                    : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                } ${blocked || eligLoading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <span className="text-2xl flex-shrink-0">{role.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-neutral-900">
                      {roleName(role.key)}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-200 text-xs font-medium text-neutral-600">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        {t("currentRole")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{roleDescKey(role.key)}</p>
                </div>
                {isSelected && !isCurrent && (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Warning */}
        <div className="px-5 mt-3">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 leading-relaxed">
            {t("changeRoleWarning")}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 mt-2">
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 leading-relaxed">
              {error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="px-5 py-4 mt-1 flex gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {t("cancel") || "Cancel"}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedRole || selectedRole === currentRole || loading || blocked || eligLoading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {selectedRole && selectedRole !== currentRole
              ? `${t("changeRoleConfirm")} ${roleName(selectedRole)}`
              : t("changeRoleConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
