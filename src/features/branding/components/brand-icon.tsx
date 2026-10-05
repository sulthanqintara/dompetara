import Image from "next/image";

export function BrandIcon({ size = 44 }: { size?: number }) {
  return <Image src="/icons/dompetara-mark.svg" alt="Dompetara" width={size} height={size} unoptimized className="shrink-0" />;
}
