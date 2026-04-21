/**
 * Safely extract a display name from a crop field that may be
 * either a plain string or a nested object `{id, code, name_en, name_si, category}`.
 */
export function cropName(crop: any, locale?: string): string {
  if (typeof crop === 'object' && crop !== null) {
    return (locale === 'si' ? crop.name_si : crop.name_en) || crop.name_en || crop.code || 'Unknown';
  }
  return crop || 'Unknown';
}

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return `${count} ${singular}`;
  return `${count} ${plural || singular + 's'}`;
}

/**
 * Timezone-safe date formatting.
 * Parses date strings as plain calendar dates WITHOUT timezone conversion.
 * Accepts "2026-04-15", "2026-04-15T00:00:00Z", or "2026-04-15T00:00:00+05:30".
 * Always returns the date as-is from the string, never shifted.
 */
export function formatDateSafe(dateStr: string | null | undefined, style: "short" | "long" | "iso" = "short"): string {
  if (!dateStr) return "";
  // Extract just the YYYY-MM-DD portion, ignoring any time/timezone suffix
  const isoDate = dateStr.split("T")[0];
  const parts = isoDate.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const monthNum = parseInt(m, 10);
  const dayNum = parseInt(d, 10);

  if (style === "iso") return isoDate; // "2026-04-15"

  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  if (style === "long") return `${MONTHS_LONG[monthNum - 1]} ${dayNum}, ${y}`;
  return `${MONTHS_SHORT[monthNum - 1]} ${dayNum}, ${y}`; // "Apr 15, 2026"
}

/**
 * Extract just the YYYY-MM-DD part from any date string.
 * Safe to use for <input type="date" value={...} />.
 */
export function toDateInputValue(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return dateStr.split("T")[0];
}

export function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'proposed': 'Proposed',
    'farmer_accepted': 'Farmer Accepted',
    'buyer_accepted': 'Buyer Accepted',
    'confirmed': 'Confirmed',
    'in_transit': 'In Transit',
    'fulfilled': 'Fulfilled',
    'disputed': 'Disputed',
    'cancelled': 'Cancelled',
    'expired': 'Expired',
    'planned': 'Planned',
    'ready': 'Ready',
    'matched': 'Matched',
    'open': 'Open',
    'reviewing': 'Reviewing',
    'closed': 'Closed',
  };
  return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
