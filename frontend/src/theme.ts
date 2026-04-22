export const colors = {
  background: "#05050A",
  surfaceElevated: "#0F0F14",
  surfaceSecondary: "#1A1A20",
  textPrimary: "#F8F8F8",
  textSecondary: "#A0A0A5",
  textTertiary: "#6B6B72",
  accent: "#F59E0B",
  accentHover: "#D97706",
  accentSoft: "rgba(245, 158, 11, 0.15)",
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.14)",
  danger: "#EF4444",
  success: "#10B981",
  overlay: "rgba(0,0,0,0.55)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 18,
  xl: 28,
  pill: 999,
};

export const fallbackArt =
  "https://images.unsplash.com/photo-1628160634750-a81a2a780805?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHBvZGNhc3QlMjBjb3ZlciUyMGFydHxlbnwwfHx8fDE3NzY4ODg2OTl8MA&ixlib=rb-4.1.0&q=85";

export const emptyStateMic =
  "https://images.unsplash.com/photo-1552174588-6733961c358e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODR8MHwxfHNlYXJjaHwxfHxzdHVkaW8lMjBtaWNyb3Bob25lJTIwZGFya3xlbnwwfHx8fDE3NzY4ODg2OTl8MA&ixlib=rb-4.1.0&q=85";

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function parseDurationToSec(duration?: string): number {
  if (!duration) return 0;
  if (/^\d+$/.test(duration)) return parseInt(duration, 10);
  const parts = duration.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function relativeDate(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}
