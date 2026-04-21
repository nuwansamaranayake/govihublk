"use client";

import React from "react";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { formatDateSafe } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ListingDetail {
  id?: string;
  quantity_kg?: number | null;
  price_per_kg?: number | null;
  min_price_per_kg?: number | null;
  max_price_per_kg?: number | null;
  variety?: string | null;
  grade?: string | null;
  harvest_date?: string | null;
  available_from?: string | null;
  available_until?: string | null;
  needed_by?: string | null;
  description?: string | null;
  images?: string[] | null;
  status?: string | null;
  is_organic?: boolean | null;
  delivery_available?: boolean | null;
  is_recurring?: boolean | null;
  created_at?: string | null;
}

interface ListingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "harvest" | "demand";
  listing: ListingDetail | null;
  cropName?: string | null;
  partyName?: string | null;
  partyDistrict?: string | null;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-neutral-50 last:border-0">
      <span className="text-sm text-neutral-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-neutral-800 text-right ml-4">{value}</span>
    </div>
  );
}

export function ListingDetailsModal({
  isOpen,
  onClose,
  type,
  listing,
  cropName,
  partyName,
  partyDistrict,
}: ListingDetailsModalProps) {
  const t = useTranslations("matches");
  const tc = useTranslations("common");

  if (!listing) return null;

  const isHarvest = type === "harvest";
  const headerColor = isHarvest ? "bg-green-700" : "bg-amber-600";
  const headerIcon = isHarvest ? "🌾" : "📋";

  // Pick first image if available
  const imageUrl =
    listing.images && listing.images.length > 0 ? listing.images[0] : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      {/* Custom header inside modal body */}
      <div className={`-mx-6 -mt-4 px-6 py-4 ${headerColor} text-white rounded-t-2xl sm:rounded-t-xl`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{headerIcon}</span>
          <div>
            <h2 className="text-lg font-bold">
              {isHarvest ? t("harvestDetails") : t("demandDetails")}
            </h2>
            {cropName && <p className="text-sm opacity-90">{cropName}</p>}
          </div>
        </div>
      </div>

      {/* Image */}
      {imageUrl ? (
        <div className="-mx-6 mt-0">
          <img
            src={imageUrl}
            alt={cropName || "Listing"}
            className="w-full h-48 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      ) : (
        <div className="-mx-6 mt-0 h-32 bg-neutral-100 flex items-center justify-center">
          <span className="text-5xl opacity-30">{isHarvest ? "🌾" : "📦"}</span>
        </div>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap gap-2 mt-4 mb-2">
        {listing.status && (
          <Badge color={listing.status === "ready" || listing.status === "open" ? "green" : "gray"} size="sm">
            {listing.status}
          </Badge>
        )}
        {listing.is_organic && (
          <Badge color="green" size="sm">🌿 {tc("organic") || "Organic"}</Badge>
        )}
        {listing.delivery_available && (
          <Badge color="blue" size="sm">🚚 {tc("delivery") || "Delivery"}</Badge>
        )}
        {listing.is_recurring && (
          <Badge color="gold" size="sm">🔄 {tc("recurring") || "Recurring"}</Badge>
        )}
      </div>

      {/* Details grid */}
      <div className="mt-2">
        {isHarvest ? (
          <>
            <DetailRow label={t("quantityAvailable")} value={listing.quantity_kg ? `${listing.quantity_kg} kg` : null} />
            <DetailRow label={t("askingPrice")} value={listing.price_per_kg ? `Rs. ${listing.price_per_kg.toLocaleString()}/kg` : null} />
            {listing.min_price_per_kg && (
              <DetailRow label={t("minPrice") || "Min Price"} value={`Rs. ${listing.min_price_per_kg.toLocaleString()}/kg`} />
            )}
            <DetailRow label={t("variety")} value={listing.variety} />
            <DetailRow label={t("grade")} value={listing.grade} />
            <DetailRow label={t("harvestDate") || "Harvest Date"} value={listing.harvest_date ? formatDateSafe(listing.harvest_date) : null} />
            <DetailRow label={t("available")} value={
              listing.available_from
                ? `${formatDateSafe(listing.available_from)}${listing.available_until ? ` — ${formatDateSafe(listing.available_until)}` : ""}`
                : null
            } />
          </>
        ) : (
          <>
            <DetailRow label={t("quantityNeeded")} value={listing.quantity_kg ? `${listing.quantity_kg} kg` : null} />
            <DetailRow label={t("maxPrice")} value={listing.max_price_per_kg ? `Rs. ${listing.max_price_per_kg.toLocaleString()}/kg` : null} />
            <DetailRow label={t("variety")} value={listing.variety} />
            <DetailRow label={t("grade")} value={listing.grade} />
            <DetailRow label={t("neededBy")} value={listing.needed_by ? formatDateSafe(listing.needed_by) : null} />
          </>
        )}

        {/* Shared fields */}
        {partyName && (
          <DetailRow label={isHarvest ? (t("farmer") || "Farmer") : (t("buyer") || "Buyer")} value={
            <span>{partyName}{partyDistrict ? <span className="text-neutral-400"> · {partyDistrict}</span> : ""}</span>
          } />
        )}
        <DetailRow label={t("dateListed") || "Listed"} value={listing.created_at ? formatDateSafe(listing.created_at) : null} />
      </div>

      {/* Description */}
      {listing.description && (
        <div className="mt-4 p-3 bg-neutral-50 rounded-xl">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">{tc("description") || "Description"}</p>
          <p className="text-sm text-neutral-700 leading-relaxed">{listing.description}</p>
        </div>
      )}

      {/* Close button */}
      <div className="mt-5">
        <button
          onClick={onClose}
          className="w-full py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors"
        >
          {tc("close") || "Close"}
        </button>
      </div>
    </Modal>
  );
}

export default ListingDetailsModal;
