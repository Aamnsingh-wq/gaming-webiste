import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return <main className="auth-page"><Link className="auth-back" href="/">← Back to Arena</Link><section className="auth-panel"><p className="eyebrow">Your next match starts here</p><h1>Welcome<br />back, player.</h1><AuthForm mode="login" /></section></main>;
}