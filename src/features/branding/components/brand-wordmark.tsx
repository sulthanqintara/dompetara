import type { CSSProperties } from "react";
import { BrandIcon } from "./brand-icon";

export function BrandWordmark({ size = 44 }: { size?: number }) {
  return (
    <span className="brand-wordmark" role="img" aria-label="Dompetara" style={{ "--brand-size": `${size}px`, fontSize: size * 0.4 } as CSSProperties}>
      <span className="brand-wordmark-mark" aria-hidden="true"><BrandIcon size={size} /></span>
      <span className="brand-wordmark-text" aria-hidden="true">ompetara</span>
    </span>
  );
}
