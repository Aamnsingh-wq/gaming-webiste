import type { Metadata } from "next";
import { ExternalLink, ShoppingBag } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { getStoreProducts } from "@/lib/data/public";
import { isHttpUrl } from "@/lib/validation";

export const metadata: Metadata = { title: "Store", description: "Gear and merch picked for competitive players." };

export default async function StorePage() {
  const products = await getStoreProducts();
  return (
    <main className="page container">
      <PageHeader eyebrow="Community store" title={<>Gear for the <span className="gradient-text">next match</span></>} lead="Partner gear and community merch. Partner links open the retailer's site in a new tab." />
      {products.length ? (
        <div className="grid-3">
          {products.map((product, index) => (
            <article key={product.id} className="card card-hover reward-card reveal" style={{ animationDelay: `${index * 60}ms` }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-provided remote images */}
              {isHttpUrl(product.image_url) && <img className="product-img" src={product.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />}
              <span className="badge" style={{ alignSelf: "start" }}>{product.category}</span>
              <h2 style={{ fontSize: 21 }}>{product.name}</h2>
              {product.description && <p className="muted" style={{ fontSize: 14 }}>{product.description}</p>}
              <div className="actions">
                {product.price_cents !== null && <div className="cost">₹{(product.price_cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>}
                {product.purchase_type === "affiliate" && isHttpUrl(product.affiliate_url)
                  ? <a className="btn btn-neon btn-block" href={product.affiliate_url} target="_blank" rel="nofollow sponsored noopener noreferrer">View on partner store <ExternalLink size={15} /></a>
                  : <span className="btn btn-ghost btn-block" aria-disabled="true">Checkout coming soon</span>}
              </div>
            </article>
          ))}
        </div>
      ) : <EmptyState icon={ShoppingBag} title="Store opening soon">No products are published yet.</EmptyState>}
    </main>
  );
}
