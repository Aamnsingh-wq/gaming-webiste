"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, X } from "lucide-react";

export const NAV_LINKS = [
  { href: "/tournaments", label: "Tournaments" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/teams", label: "Teams" },
  { href: "/rewards", label: "Rewards" },
  { href: "/store", label: "Store" },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="main-nav">
      {NAV_LINKS.map((link) => (
        <Link key={link.href} className="nav-link" href={link.href} aria-current={isActive(pathname, link.href) ? "page" : undefined}>{link.label}</Link>
      ))}
    </nav>
  );
}

export function MobileNav({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const links = [...NAV_LINKS, ...(signedIn ? [{ href: "/dashboard", label: "Player HQ" }] : []), ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : [])];
  return (
    <>
      <button className="icon-btn menu-toggle" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((value) => !value)}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav id="mobile-nav" className="mobile-nav" data-open={open} aria-label="Mobile" aria-hidden={!open} inert={!open}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={isActive(pathname, link.href) ? "page" : undefined}>{link.label}<ChevronRight size={20} /></Link>
        ))}
        {!signedIn && (
          <>
            <Link className="btn btn-primary" href="/register">Create account</Link>
            <Link className="btn btn-ghost" href="/login">Log in</Link>
          </>
        )}
        {signedIn && <form action="/auth/signout" method="post"><button className="btn btn-ghost" type="submit">Log out</button></form>}
      </nav>
    </>
  );
}
