const TIME_ZONE = "Asia/Kolkata";

const dayFormat = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: TIME_ZONE });
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const numberFormat = new Intl.NumberFormat("en-IN");

export const formatDay = (value: string) => dayFormat.format(new Date(value));
export const formatDateTime = (value: string) => `${dateTimeFormat.format(new Date(value))} IST`;
export const formatNumber = (value: number | string | null | undefined) => numberFormat.format(Number(value ?? 0));

export function formatRelative(value: string, now = Date.now()) {
  const diff = new Date(value).getTime() - now;
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86_400_000], ["hour", 3_600_000], ["minute", 60_000]];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of units) if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  return "just now";
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  registration_open: "Registration open",
  upcoming: "Upcoming",
  live: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  unverified: "Unverified",
  verified: "Verified",
  scheduled: "Scheduled",
  award: "Award",
  redemption: "Redemption",
  adjustment: "Adjustment",
  refund: "Refund",
  captain: "Captain",
  member: "Member",
};

export const FORMAT_LABELS: Record<string, string> = {
  single_elimination: "Single elimination",
  double_elimination: "Double elimination",
  round_robin: "Round robin",
  points: "Points race",
};

export const statusLabel = (value: string) => STATUS_LABELS[value] ?? value.replace(/_/g, " ");
