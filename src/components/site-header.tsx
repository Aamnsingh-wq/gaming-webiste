import Link from "next/link";
import { Coins, LogIn, ShieldCheck } from "lucide-react";
import { getViewer } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { BrandMark } from "@/components/brand";
import { MainNav, MobileNav } from "@/components/nav";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link aria-label="ARENA home" className="brand" href="/"><BrandMark /></Link>
        <MainNav />
        <div className="header-actions">
          {viewer ? (
            <>
              {viewer.isAdmin && <Link className="btn btn-ghost btn-sm hide-mobile" href="/admin"><ShieldCheck size={15} /> Admin</Link>}
              <Link className="points-chip" href="/rewards" title="Reward points"><Coins size={14} /> {formatNumber(viewer.points)}</Link>
              <Link href="/dashboard" aria-label="Your dashboard" title="Player HQ"><Avatar name={viewer.displayName} src={viewer.avatarUrl} /></Link>
            </>
          ) : (
            <>
              <Link className="nav-link hide-mobile" href="/login"><LogIn size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />Log in</Link>
              <Link className="btn btn-primary btn-sm hide-mobile" href="/register">Join now</Link>
            </>
          )}
          <MobileNav signedIn={Boolean(viewer)} isAdmin={Boolean(viewer?.isAdmin)} />
        </div>
      </div>
    </header>
  );
}
