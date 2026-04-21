"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

interface Ad {
  id: string;
  title: string;
  title_si?: string;
  description?: string;
  description_si?: string;
  image_url: string;
  click_url?: string;
}

export default function AdCarousel() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const [ads, setAds] = useState<Ad[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch active ads
  useEffect(() => {
    api
      .get<{ ads: Ad[] }>("/ads/active?limit=5")
      .then((res) => {
        const adList = res?.ads || [];
        setAds(adList);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-rotate every 5 seconds
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (ads.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % ads.length);
    }, 5000);
  }, [ads.length]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  // Touch handling for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        setCurrent((prev) => (prev + 1) % ads.length);
      } else {
        setCurrent((prev) => (prev - 1 + ads.length) % ads.length);
      }
    }
    startTimer();
  };

  // Click handler
  const handleAdClick = async (ad: Ad) => {
    // Track click (fire-and-forget)
    api.post(`/ads/${ad.id}/click`, { page_url: window.location.pathname }).catch(() => {});
    // Open link
    if (ad.click_url) {
      window.open(ad.click_url, "_blank", "noopener,noreferrer");
    }
  };

  // Hide when no ads, error, or loading with no results
  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm overflow-hidden animate-pulse">
        <div className="aspect-[16/9] bg-neutral-200" />
        <div className="p-3 space-y-2">
          <div className="h-4 bg-neutral-200 rounded w-3/4" />
          <div className="h-3 bg-neutral-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error || ads.length === 0) {
    return null;  // Hide cleanly — no empty card, no error
  }

  const ad = ads[current];
  const title = locale === "si" && ad.title_si ? ad.title_si : ad.title;
  const desc = locale === "si" && ad.description_si ? ad.description_si : ad.description;

  return (
    <div
      ref={containerRef}
      data-testid="ad-carousel"
      className="rounded-2xl bg-white border border-neutral-200 shadow-sm overflow-hidden"
      onMouseEnter={() => { if (timerRef.current) clearInterval(timerRef.current); }}
      onMouseLeave={startTimer}
    >
      {/* Banner */}
      <div
        className="relative cursor-pointer"
        onClick={() => handleAdClick(ad)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        data-testid="ad-banner"
      >
        <img
          src={ad.image_url}
          alt={title}
          className="w-full aspect-[16/9] object-cover"
          loading="lazy"
        />
        {/* Sponsored label */}
        <span
          data-testid="ad-sponsored-label"
          className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full"
        >
          {locale === "si" ? "දැන්වීම" : "Sponsored"}
        </span>
      </div>

      {/* Title + Description */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-neutral-800 line-clamp-1">
          📢 {title}
        </p>
        {desc && (
          <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{desc}</p>
        )}
      </div>

      {/* Dot indicators */}
      {ads.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-2.5">
          {ads.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrent(i); startTimer(); }}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === current ? "bg-green-600" : "bg-neutral-300"
              }`}
              aria-label={`Ad ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
