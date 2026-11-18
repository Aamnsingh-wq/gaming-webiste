import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return <main className="auth-page"><Link className="auth-back" href="/">← Back to Arena</Link><section className="auth-panel"><p className="eyebrow">One account. Every arena.</p><h1>Make your<br />entrance.</h1><AuthForm mode="register" /></section></main>;
}