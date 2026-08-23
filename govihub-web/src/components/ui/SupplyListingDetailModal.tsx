"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { api } from "@/lib/api";

interface SupplierInfo {
  id: string;
  name: string;
  phone: string;
  district: string | null;
  member_since: string | null;
}

interface SupplyListingDetail {
  id: string;
  supplier_id: string;
  category: string;
  name: string;
  name_si: string | null;
  description: string | null;
  price: number | null;
  unit: string | null;
  stock_quantity: number | null;
  photos: string[];
  thumbnail: string | null;
  supplier_name: string | null;
  supplier_district: string | null;
  delivery_available: boolean;
  delivery_radius_km: number | null;
  status: string;
  distance_km: number | null;
  created_at: string;
  updated_at: string;
  supplier: SupplierInfo | null;
}

interface SupplyListingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string | null;
}

const CATEGORY_ICON: Record<string, string> = {
  fertilizer: "🌿",
  seeds: "🌱",
  pesticide: "🧪",
  equipment: "🚜",
  transport: "🚛",
  irrigation: "💧",
  other: "📦",
};

export function SupplyListingDetailModal({
  isOpen,
  onClose,
  listingId,
}: SupplyListingDetailModalProps) {
  const t = useTranslations();
  const [listing, setListing] = useState<SupplyListingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !listingId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setListing(null);
    api
      .get<SupplyListingDetail>(`/marketplace/listings/${listingId}`)
      .then((res) => {
        if (!cancelled) setListing(res);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || "Failed to load listing");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, listingId]);

  const photos = listing?.photos?.filter((p) => typeof p === "string" && p.length > 0) ?? [];
  const supplier = listing?.supplier ?? null;
  const waPhone = supplier?.phone ? supplier.phone.replace("+", "") : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      {loading ? (
        <div className="space-y-3 py-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 my-2">
          {error}
        </div>
      ) : listing ? (
        <>
          {/* Photos */}
          {photos.length > 0 ? (
            <div className="-mx-6 -mt-4 flex gap-2 overflow-x-auto px-6 pt-2 pb-2 bg-neutral-50">
              {photos.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={listing.name}
                  loading="lazy"
                  className="h-44 w-64 shrink-0 rounded-xl object-cover bg-neutral-100"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="-mx-6 -mt-4 h-32 bg-neutral-100 flex flex-col items-center justify-center gap-1">
              <span className="text-4xl opacity-30" aria-hidden="true">📦</span>
              <span className="text-xs text-neutral-400">{t("marketplace.no_photos")}</span>
            </div>
          )}

          {/* Name + category */}
          <div className="mt-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-neutral-900">{listing.name}</h2>
                {listing.name_si && (
                  <p className="text-sm text-neutral-500">{listing.name_si}</p>
                )}
              </div>
              <Badge color="gray" size="sm">
                {CATEGORY_ICON[listing.category] || "📦"} {listing.category}
              </Badge>
            </div>

            {/* Price */}
            <p className="text-xl font-bold text-green-700 mt-2">
              {listing.price != null
                ? `Rs. ${listing.price.toLocaleString()}${listing.unit ? ` / ${listing.unit}` : ""}`
                : "—"}
            </p>

            <div className="flex flex-wrap gap-2 mt-2">
              {listing.stock_quantity != null && (
                <Badge color="gray" size="sm">Stock: {listing.stock_quantity}</Badge>
              )}
              {listing.delivery_available && (
                <Badge color="blue" size="sm">
                  🚚 {listing.delivery_radius_km != null ? `${listing.delivery_radius_km} km` : ""}
                </Badge>
              )}
              {listing.distance_km != null && (
                <Badge color="gold" size="sm">📍 {listing.distance_km} km</Badge>
              )}
            </div>
          </div>

          {/* Description */}
          {listing.description && (
            <div className="mt-4 p-3 bg-neutral-50 rounded-xl">
              <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            </div>
          )}

          {/* Supplier block */}
          <div className="mt-4 border border-neutral-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              {t("marketplace.supplier_details")}
            </p>
            {supplier ? (
              <>
                <p className="text-sm font-semibold text-neutral-900">{supplier.name}</p>
                {supplier.district && (
                  <p className="text-xs text-neutral-500 mt-0.5">📍 {supplier.district}</p>
                )}
                <p className="text-sm text-neutral-700 mt-1">{supplier.phone}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <a
                    href={`tel:${supplier.phone}`}
                    className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    📞 {t("marketplace.call_supplier")}
                  </a>
                  <a
                    href={`https://wa.me/${waPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-xl border border-green-600 text-green-700 hover:bg-green-50 transition-colors"
                  >
                    💬 {t("marketplace.whatsapp_supplier")}
                  </a>
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-500">
                {listing.supplier_name || "—"}
                {listing.supplier_district ? ` · ${listing.supplier_district}` : ""}
              </p>
            )}
          </div>

          {/* Close */}
          <div className="mt-5">
            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors"
            >
              {t("common.close")}
            </button>
          </div>
        </>
      ) : null}
    </Modal>
  );
}

export default SupplyListingDetailModal;
