import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARENA — Community Esports",
  description: "Find your next match. Compete across BGMI, VALORANT, Brawl Stars, Minecraft, and more.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}