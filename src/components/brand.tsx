import { Crosshair } from "lucide-react";

export function BrandMark() {
  return (
    <>
      <span className="brand-mark" aria-hidden="true"><Crosshair size={18} strokeWidth={2.5} /></span>
      <span>ARENA<span className="brand-dot">.</span></span>
    </>
  );
}
