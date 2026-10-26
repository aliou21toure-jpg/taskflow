import { useState, type FormEvent } from "react";
import type { Credentials } from "../api";

type Mode = "login" | "register";

interface Props {
  onSubmit: (mode: Mode, credentials: Credentials) => Promise<void>;
  /** Shown above the form, e.g. "Your session has expired". */
  notice?: string;
  /** Public demo account for the hosted demo; hidden when not configured. */
  demo?: Credentials;
}

export function AuthForm({ onSubmit, notice, demo }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(m: Mode, c: Credentials) {
    setPending(true);
    setError(null);
    try {
      await onSubmit(m, c);
    } catch (e) {
      setError((e as Error).message);
      setPending(false); // stay on the form, keep what was typed
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(mode, { email: email.trim(), password });
  }

  const isLogin = mode === "login";
  return (
    <main className="auth">
      <h1>TaskFlow</h1>
      <p className="auth__tagline">Your tasks, private to your account.</p>
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <form className="auth__form" onSubmit={handleSubmit} aria-label={isLogin ? "Sign in" : "Create account"}>
        <h2>{isLogin ? "Sign in" : "Create an account"}</h2>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={isLogin ? undefined : 8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {!isLogin && <p className="hint">At least 8 characters. A short phrase works well.</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending}>
          {pending ? (isLogin ? "Signing in…" : "Creating account…") : isLogin ? "Sign in" : "Create account"}
        </button>
        <p className="auth__switch">
          {isLogin ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(isLogin ? "register" : "login");
              setError(null);
            }}
          >
            {isLogin ? "Create an account" : "Sign in instead"}
          </button>
        </p>
      </form>
      {demo && (
        <div className="demo">
          <p>Just looking? Use the shared demo account, or create your own private one.</p>
          <button type="button" className="secondary" disabled={pending} onClick={() => void submit("login", demo)}>
            Try the demo account
          </button>
        </div>
      )}
    </main>
  );
}
