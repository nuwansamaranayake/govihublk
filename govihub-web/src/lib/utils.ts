export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return `${count} ${singular}`;
  return `${count} ${plural || singular + 's'}`;
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
