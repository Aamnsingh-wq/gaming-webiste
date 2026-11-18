import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function StorePage() {
  const supabase = await createSupabaseServerClient();
  const { data: products } = supabase ? await supabase.from("products").select("id, name, description, category, purchase_type, affiliate_url, price_cents").eq("is_active", true).order("name") : { data: [] };

  return <main className="dashboard-page"><div className="dashboard-top"><Link className="brand" href="/"><span className="brand-mark">A</span><span>ARENA<span className="brand-dot">.</span></span></Link><Link className="text-button" href="/dashboard">Player HQ</Link></div><section className="dashboard-content"><p className="eyebrow">COMMUNITY STORE</p><h1>Gear for the next match.</h1><div className="store-grid">{products?.length ? products.map((product) => <article className="store-card" key={product.id}><p className="eyebrow">{product.category}</p><h2>{product.name}</h2><p>{product.description}</p>{product.purchase_type === "affiliate" && product.affiliate_url ? <a className="button" href={product.affiliate_url} target="_blank" rel="nofollow sponsored">View on partner store</a> : <span>{product.price_cents === null ? "Checkout unavailable" : `₹${(product.price_cents / 100).toFixed(2)}`}</span>}</article>) : <p className="auth-copy">No store products are published yet.</p>}</div></section></main>;
}
