import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { Feedback } from "@/components/use-api";

export function FeedbackNotice({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  const Icon = feedback.tone === "success" ? CheckCircle2 : feedback.tone === "error" ? TriangleAlert : Info;
  return (
    <p className={`notice notice-${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>
      <Icon size={17} style={{ flex: "none", marginTop: 2 }} />
      <span>{feedback.text}</span>
    </p>
  );
}

export function SubmitLabel({ busy, children, busyText = "Working…" }: { busy: boolean; children: React.ReactNode; busyText?: string }) {
  return busy ? <><span className="spinner" aria-hidden="true" />{busyText}</> : <>{children}</>;
}
