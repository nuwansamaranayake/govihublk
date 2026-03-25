"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

const DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo",
  "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara",
  "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar",
  "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya",
  "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya",
];

const ROLE_OPTIONS = [
  { key: "farmer", icon: "\uD83C\uDF3E", label: "Farmer", labelSi: "\u0D9C\u0DDC\u0DC0\u0DD2\u0DBA\u0DCF" },
  { key: "buyer", icon: "\uD83D\uDED2", label: "Buyer", labelSi: "\u0D9C\u0DD0\u0DB1\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4" },
  { key: "supplier", icon: "\uD83D\uDCE6", label: "Supplier", labelSi: "\u0DC3\u0DD0\u0DB4\u0DBA\u0DD4\u0DB8\u0DCA\u0D9A\u0DBB\u0DD4" },
];

function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

export default function BetaLoginPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Register state
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPw, setShowRegPw] = useState(false);
  const [regRole, setRegRole] = useState("farmer");
  const [regDistrict, setRegDistrict] = useState("");
  const [regLanguage, setRegLanguage] = useState<"si" | "en">("si");
  const [regPhone, setRegPhone] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setError("Username and password are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/beta/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Login failed (${res.status})`);
      }
      const data = await res.json();
      if (typeof window !== "undefined") {
        sessionStorage.setItem("govihub_dev_token", data.access_token);
        sessionStorage.setItem("govihub_dev_user", JSON.stringify(data.user));
      }
      const role = data.user?.role || "farmer";
      router.push(`/${locale}/${role}/dashboard`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!regName.trim()) { setError("Full name is required"); return; }
    if (!regUsername.trim()) { setError("Username is required"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(regUsername.trim())) { setError("Username: letters, numbers, underscore only"); return; }
    if (regPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (!regDistrict) { setError("Please select your district"); return; }
    setLoading(true);
    try {
      const body: Record<string, string> = {
        username: regUsername.trim(),
        password: regPassword,
        name: regName.trim(),
        role: regRole,
        district: regDistrict,
        language: regLanguage,
      };
      if (regPhone.trim()) body.phone = regPhone.trim();
      const res = await fetch(`${API_URL}/auth/beta/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Registration failed (${res.status})`);
      }
      const data = await res.json();
      if (typeof window !== "undefined") {
        sessionStorage.setItem("govihub_dev_token", data.access_token);
        sessionStorage.setItem("govihub_dev_user", JSON.stringify(data.user));
      }
      const role = data.user?.role || regRole;
      router.push(`/${locale}/${role}/dashboard`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600 text-white text-2xl font-bold mb-3 shadow-lg">
            GH
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">GoviHub Beta</h1>
          <p className="text-neutral-500 text-sm mt-1">Smart Farming Marketplace</p>
          <div className="mt-2 inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
            NOT FOR PRODUCTION
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-neutral-200 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setTab("login"); setError(null); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              tab === "login"
                ? "bg-white text-green-700 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setTab("register"); setError(null); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              tab === "register"
                ? "bg-white text-green-700 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            Register
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* =============== LOGIN TAB =============== */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showLoginPw ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPw(!showLoginPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition"
                >
                  <EyeIcon open={showLoginPw} />
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <><Spinner /> Logging in...</> : "Login"}
            </button>

            <p className="text-center text-sm text-neutral-500 mt-4">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => { setTab("register"); setError(null); }}
                className="text-green-600 font-medium hover:underline"
              >
                Register
              </button>
            </p>
          </form>
        )}

        {/* =============== REGISTER TAB =============== */}
        {tab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name</label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="e.g. Kamal Perera"
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Username</label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="e.g. kamal_perera"
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              />
              <p className="text-xs text-neutral-400 mt-1">Letters, numbers, underscore only</p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showRegPw ? "text" : "password"}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPw(!showRegPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition"
                >
                  <EyeIcon open={showRegPw} />
                </button>
              </div>
              <p className="text-xs text-neutral-400 mt-1">Minimum 6 characters</p>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRegRole(r.key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                      regRole === r.key
                        ? "border-green-500 bg-green-50 shadow-sm"
                        : "border-neutral-200 bg-white hover:border-neutral-300"
                    }`}
                  >
                    <span className="text-2xl">{r.icon}</span>
                    <span className="text-xs font-medium text-neutral-800">{r.label}</span>
                    <span className="text-[10px] text-neutral-500">{r.labelSi}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* District */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">District</label>
              <select
                value={regDistrict}
                onChange={(e) => setRegDistrict(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition appearance-none"
              >
                <option value="">Select your district</option>
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Language Toggle */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Language</label>
              <div className="flex bg-neutral-200 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setRegLanguage("si")}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    regLanguage === "si"
                      ? "bg-white text-green-700 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {"\u0DC3\u0DD2\u0D82\u0DC4\u0DBD"}
                </button>
                <button
                  type="button"
                  onClick={() => setRegLanguage("en")}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    regLanguage === "en"
                      ? "bg-white text-green-700 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Phone <span className="text-neutral-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+94..."
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <><Spinner /> Creating account...</> : "Create Account"}
            </button>

            <p className="text-center text-sm text-neutral-500 mt-4">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setTab("login"); setError(null); }}
                className="text-green-600 font-medium hover:underline"
              >
                Login
              </button>
            </p>
          </form>
        )}

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-neutral-400">
          <p>GoviHub Beta &mdash; Smart Farming Marketplace</p>
          <p className="mt-1">API: {API_URL}</p>
        </div>
      </div>
    </div>
  );
}
