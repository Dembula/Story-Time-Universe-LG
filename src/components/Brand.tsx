import logoWide from "@/assets/logo.png";
import mark from "@/assets/mark.png";

/** The wide black "S.T" wordmark used across the Story Time apps. */
export function Logo({ className }: { className?: string }) {
  return <img src={logoWide} alt="Story Time" className={className} draggable={false} />;
}

/** The square "S.T" brand mark (matches the app icon). */
export function LogoMark({ className }: { className?: string }) {
  return <img src={mark} alt="Story Time" className={className} draggable={false} />;
}
