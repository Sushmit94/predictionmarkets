const compactFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 2,
});

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatProbability(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatGdollar(value: string | number): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "G$0";
  return `G$${compactFormatter.format(numeric)}`;
}

export function formatNumber(value: string | number): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return numberFormatter.format(numeric);
}

export function timeUntil(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days > 0) return `${days}d left`;

  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours > 0) return `${hours}h left`;

  const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
  return `${minutes}m left`;
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export function shortenAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
