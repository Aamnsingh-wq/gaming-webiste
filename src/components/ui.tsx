import type { LucideIcon } from "lucide-react";
import { statusLabel } from "@/lib/format";
import { isHttpUrl } from "@/lib/validation";

export function Badge({ status, label, live }: { status: string; label?: string; live?: boolean }) {
  return (
    <span className={`badge badge-${status}`}>
      {(live ?? status === "live") && <i className="pulse" aria-hidden="true" />}
      {label ?? statusLabel(status)}
    </span>
  );
}

export function Avatar({ name, src, size }: { name: string; src?: string | null; size?: "lg" | "xl" }) {
  const className = `avatar${size ? ` avatar-${size}` : ""}`;
  if (isHttpUrl(src)) {
    // eslint-disable-next-line @next/next/no-img-element -- user-supplied remote avatars; no fixed host list for next/image
    return <img className={className} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />;
  }
  return <span className={className} aria-hidden="true">{(name.trim()[0] ?? "?").toUpperCase()}</span>;
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <Icon size={34} strokeWidth={1.5} />
      <h3>{title}</h3>
      {children && <p style={{ maxWidth: 440 }}>{children}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Stat({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="stat" style={accent ? ({ "--stat-accent": accent } as React.CSSProperties) : undefined}>
      <div className="stat-label"><Icon size={14} />{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, lead, children }: { eyebrow: string; title: React.ReactNode; lead?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="section-head reveal">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {children}
    </div>
  );
}
