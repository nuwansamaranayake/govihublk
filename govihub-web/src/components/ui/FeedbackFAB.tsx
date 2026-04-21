"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";

type FeedbackCategory = "bug" | "idea" | "general";

const CATEGORY_KEYS: { key: FeedbackCategory; labelKey: string; icon: string }[] = [
  { key: "bug", labelKey: "feedback.bug", icon: "\uD83D\uDC1B" },
  { key: "idea", labelKey: "feedback.idea", icon: "\uD83D\uDCA1" },
  { key: "general", labelKey: "feedback.general", icon: "\uD83D\uDCAC" },
];

export default function FeedbackFAB() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sent) {
      const timer = setTimeout(() => {
        setSent(false);
        setOpen(false);
        setMessage("");
        setRating(0);
        setCategory("general");
        setError(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [sent]);

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError(t("feedback.pleaseEnter"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const token = typeof window !== "undefined" ? sessionStorage.getItem("govihub_token") : null;
      const res = await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: message.trim(),
          rating: rating || null,
          category,
          page_url: typeof window !== "undefined" ? window.location.pathname : "",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed (${res.status})`);
      }
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("feedback.failedToSend"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => { setOpen(true); setError(null); }}
        className="fixed bottom-36 right-4 z-40 w-10 h-10 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        aria-label={t("feedback.sendFeedback")}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              /* Success State */
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-green-700">{t("feedback.thankYou")}</p>
                <p className="text-sm text-neutral-500 mt-1">{t("feedback.feedbackSent")}</p>
              </div>
            ) : (
              /* Form */
              <div className="p-5">
                <h3 className="text-lg font-semibold text-neutral-900 mb-1 flex items-center gap-2">
                  <Image src="/images/logo-icon-sm.png" alt="GoviHub" width={24} height={24} className="rounded-md" />
                  {t("feedback.sendFeedback")}
                </h3>
                <p className="text-sm text-neutral-500 mb-4">
                  {t("feedback.subtitle")}
                </p>

                {/* Category Selector */}
                <div className="flex rounded-xl border border-neutral-200 overflow-hidden mb-4">
                  {CATEGORY_KEYS.map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setCategory(cat.key)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                        category === cat.key
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "text-neutral-500 hover:bg-neutral-50"
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{t(cat.labelKey)}</span>
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder={t("feedback.placeholder")}
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none text-sm"
                />

                {/* Star Rating */}
                <div className="flex items-center gap-1 mt-3">
                  <span className="text-sm text-neutral-500 mr-2">{t("feedback.rating")}:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-0.5 transition-transform hover:scale-110"
                    >
                      <svg
                        className="w-7 h-7"
                        viewBox="0 0 24 24"
                        fill={(hoverRating || rating) >= star ? "#F59E0B" : "none"}
                        stroke={(hoverRating || rating) >= star ? "#F59E0B" : "#D1D5DB"}
                        strokeWidth={1.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    </button>
                  ))}
                </div>

                {error && (
                  <p className="text-sm text-red-600 mt-3">{error}</p>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setError(null); }}
                    className="flex-1 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {t("feedback.sending")}
                      </>
                    ) : (
                      t("common.send")
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
