import { useRef, useState } from "react";
import { useAppState } from "@/state/AppState";
import { useFocusable } from "@/tv/useFocusable";
import { useRemote } from "@/tv/useRemote";
import { FocusButton } from "@/components/FocusButton";
import { Logo } from "@/components/Brand";
import { AppConfig } from "@/config";
import { exitApp } from "@/tv/platform";

/**
 * Sign-in screen. Fields are focusable; pressing OK on a field opens the TV's
 * on-screen keyboard (native <input> focus triggers the webOS IME).
 */
export function SignIn() {
  const { signIn, isBusy, bootstrapError } = useAppState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(bootstrapError);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const emailField = useFocusable<HTMLDivElement>({
    autoFocus: true,
    onEnter: () => emailRef.current?.focus(),
  });
  const passwordField = useFocusable<HTMLDivElement>({
    onEnter: () => passwordRef.current?.focus(),
  });

  useRemote({ onBack: exitApp });

  const submit = async () => {
    setError(null);
    emailRef.current?.blur();
    passwordRef.current?.blur();
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    }
  };

  return (
    <div className="signin">
      <div className="signin-glow glow-a" />
      <div className="signin-glow glow-b" />

      <div className="signin-card rise-in">
        <Logo className="signin-logo-img" />
        <p className="signin-sub">Sign in to watch</p>

        <div
          ref={emailField.ref}
          className={`field tv-focusable ${emailField.focused ? "tv-focused" : ""}`}
          onClick={() => emailRef.current?.focus()}
        >
          <input
            ref={emailRef}
            type="email"
            inputMode="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div
          ref={passwordField.ref}
          className={`field tv-focusable ${passwordField.focused ? "tv-focused" : ""}`}
          onClick={() => passwordRef.current?.focus()}
        >
          <input
            ref={passwordRef}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && <div className="error-text signin-error">{error}</div>}

        <FocusButton
          onEnter={submit}
          className="btn signin-submit"
          focusClass="focus-lift"
          disabled={isBusy || !email || !password}
        >
          {isBusy ? "Signing in…" : "Sign In"}
        </FocusButton>

        <p className="signin-hint">
          New here? Create an account at <span className="accent">{AppConfig.signUpURL.replace("https://", "")}</span>
        </p>
      </div>
    </div>
  );
}
