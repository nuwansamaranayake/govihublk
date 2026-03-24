"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

const ROLES = [
  { key: "farmer", name: "Farmer", nameSi: "ගොවියා", color: "bg-green-600", icon: "🌾", desc: "Kamal Perera — Anuradhapura" },
  { key: "buyer", name: "Buyer", nameSi: "ගැනුම්කරු", color: "bg-amber-600", icon: "🛒", desc: "Nimal Silva — Colombo" },
  { key: "supplier", name: "Supplier", nameSi: "සැපයුම්කරු", color: "bg-blue-600", icon: "📦", desc: "Sunil Fernando — Kurunegala" },
  { key: "admin", name: "Admin", nameSi: "පරිපාලක", color: "bg-neutral-700", icon: "⚙️", desc: "Admin User — Colombo" },
];

export default function DevLoginPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale || "en";
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (role: string) => {
    setLoading(role);
    setError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const res = await fetch(`${API_URL}/auth/dev/login/${role}`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Login failed (${res.status})`);
      }

      const data = await res.json();

      // Store the access token (in a real app this goes through AuthContext)
      if (typeof window !== "undefined") {
        sessionStorage.setItem("govihub_dev_token", data.access_token);
        sessionStorage.setItem("govihub_dev_user", JSON.stringify(data.user));
      }

      // Redirect to role-specific dashboard
      router.push(`/${locale}/${role}/dashboard`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-600 text-white text-2xl font-bold mb-4">
            GH
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">GoviHub Dev Login</h1>
          <p className="text-neutral-500 mt-1">Development mode — pick a role to test</p>
          <div className="mt-2 inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
            NOT FOR PRODUCTION
          </div>
        </div>

        <div className="space-y-3">
          {ROLES.map((role) => (
            <button
              key={role.key}
              onClick={() => handleLogin(role.key)}
              disabled={loading !== null}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border border-neutral-200 bg-white hover:border-green-300 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className={`w-12 h-12 rounded-xl ${role.color} flex items-center justify-center text-white text-xl`}>
                {loading === role.key ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  role.icon
                )}
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-neutral-900">
                  {role.name} <span className="text-neutral-400 font-normal">/ {role.nameSi}</span>
                </div>
                <div className="text-sm text-neutral-500">{role.desc}</div>
              </div>
              <svg className="w-5 h-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 text-center text-xs text-neutral-400">
          <p>API: {process.env.NEXT_PUBLIC_API_URL || "/api/v1"}</p>
          <p className="mt-1">These test users are auto-created on first login</p>
        </div>
      </div>
    </div>
  );
}
