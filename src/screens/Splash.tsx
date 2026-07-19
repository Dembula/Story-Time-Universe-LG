import { Logo } from "@/components/Brand";

export function Splash() {
  return (
    <div className="splash">
      <Logo className="splash-logo rise-in" />
      <div className="splash-spinner">
        <div className="spinner" />
      </div>
    </div>
  );
}
