"use client";

import React, { useEffect, useState } from "react";

interface HelpStep {
  title: string;
  content: string;
}

interface HelpFAQ {
  question: string;
  answer: string;
}

interface HelpContent {
  title: string;
  description: string;
  steps: HelpStep[];
  tips: string[];
  faq: HelpFAQ[];
}

interface HelpPanelProps {
  pageKey: string;
  locale: "en" | "si";
  onClose: () => void;
}

export function HelpPanel({ pageKey, locale, onClose }: HelpPanelProps) {
  const [content, setContent] = useState<HelpContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [open, setOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Fetch help content
  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`/help/${locale}.json`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data: Record<string, HelpContent>) => {
        if (data[pageKey]) {
          setContent(data[pageKey]);
          setNotFound(false);
        } else {
          setContent(null);
          setNotFound(true);
        }
      })
      .catch(() => {
        setContent(null);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [pageKey, locale]);

  // Trigger slide-in animation after mount
  useEffect(() => {
    const timer = setTimeout(() => setOpen(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 300);
  };

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={[
          "absolute inset-0 bg-black/30 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={[
          "relative w-[320px] sm:w-[400px] max-w-full h-full bg-white shadow-xl flex flex-col",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label="Help panel"
      >
        {/* Title bar */}
        <div className="bg-green-700 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold truncate">
            {loading
              ? locale === "si"
                ? "\u0db6\u0dbd\u0dcf \u0db4\u0ddc\u0dbb\u0ddc\u0dad\u0dca\u0dad\u0dd4 \u0dc0\u0dda..."
                : "Loading..."
              : content?.title || (locale === "si" ? "\u0d8b\u0daf\u0dc0\u0dd4" : "Help")}
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Close help"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 text-base text-neutral-800">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-green-700 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {notFound && !loading && (
            <div className="text-center py-12 text-neutral-500">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-neutral-300"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="font-medium">
                {locale === "si"
                  ? "\u0db8\u0dd9\u0db8 \u0db4\u0dd2\u0da7\u0dd4\u0dc0 \u0dc3\u0db3\u0dc4\u0dcf \u0d8b\u0daf\u0dc0\u0dd4 \u0dbd\u0db6\u0dcf \u0d9c\u0dad \u0db1\u0ddc\u0dc4\u0dd0\u0d9a"
                  : "Help not available for this page"}
              </p>
            </div>
          )}

          {content && !loading && (
            <>
              {/* Description */}
              <p className="text-neutral-600 leading-relaxed">
                {content.description}
              </p>

              {/* Steps */}
              {content.steps.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide">
                    {locale === "si" ? "\u0db4\u0dd2\u0dba\u0dc0\u0dbb" : "Steps"}
                  </h3>
                  <ol className="space-y-3">
                    {content.steps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold">
                          {i + 1}
                        </span>
                        <div className="pt-0.5">
                          <p className="font-semibold text-neutral-900">
                            {step.title}
                          </p>
                          <p className="text-neutral-600 mt-0.5 leading-relaxed">
                            {step.content}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Tips */}
              {content.tips.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide">
                    {locale === "si" ? "\u0d89\u0d82\u0d9c\u0dd2\u0dad" : "Tips"}
                  </h3>
                  <div className="space-y-2">
                    {content.tips.map((tip, i) => (
                      <div
                        key={i}
                        className="flex gap-2.5 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3"
                      >
                        <span
                          className="shrink-0 text-lg leading-none mt-0.5"
                          aria-hidden="true"
                        >
                          💡
                        </span>
                        <p className="text-neutral-700 leading-relaxed">
                          {tip}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FAQ */}
              {content.faq.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide">
                    {locale === "si"
                      ? "\u0db1\u0dd2\u0dad\u0dbb \u0d85\u0dc3\u0db1 \u0db4\u0dca\u200d\u0dbb\u0dc1\u0dca\u0db1"
                      : "Frequently Asked Questions"}
                  </h3>
                  <div className="space-y-1">
                    {content.faq.map((item, i) => (
                      <div
                        key={i}
                        className="border border-neutral-200 rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => toggleFaq(i)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
                          aria-expanded={expandedFaq === i}
                        >
                          <span className="font-medium text-neutral-900 pr-2">
                            {item.question}
                          </span>
                          <svg
                            className={[
                              "w-4 h-4 shrink-0 text-neutral-400 transition-transform duration-200",
                              expandedFaq === i ? "rotate-180" : "",
                            ].join(" ")}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                        {expandedFaq === i && (
                          <div className="px-4 pb-3 text-neutral-600 leading-relaxed border-t border-neutral-100 pt-2">
                            {item.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default HelpPanel;
