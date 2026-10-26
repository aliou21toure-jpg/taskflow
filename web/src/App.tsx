import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Credentials } from "./api";
import { AuthForm } from "./components/AuthForm";
import { TaskBoard } from "./components/TaskBoard";
import type { User } from "./types";

type AuthState =
  | { status: "checking" }
  | { status: "signedOut"; notice?: string }
  | { status: "unreachable"; message: string }
  | { status: "signedIn"; user: User };

const env = import.meta.env;
const demo: Credentials | undefined =
  env.VITE_DEMO_EMAIL && env.VITE_DEMO_PASSWORD
    ? { email: env.VITE_DEMO_EMAIL, password: env.VITE_DEMO_PASSWORD }
    : undefined;

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "checking" });

  // On load, ask the server who we are. The session lives in an HttpOnly cookie that
  // this code cannot read, which is the point: only the server can tell.
  const checkSession = useCallback(async () => {
    setAuth({ status: "checking" });
    try {
      setAuth({ status: "signedIn", user: await api.me() });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuth({ status: "signedOut" });
      else setAuth({ status: "unreachable", message: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const handleSessionExpired = useCallback(
    () => setAuth({ status: "signedOut", notice: "Your session has ended. Please sign in again." }),
    [],
  );

  if (auth.status === "checking") {
    return (
      <main className="auth">
        <p role="status" className="loading">
          Loading…
        </p>
      </main>
    );
  }

  if (auth.status === "unreachable") {
    return (
      <main className="auth">
        <h1>TaskFlow</h1>
        <div role="alert" className="error banner">
          <span>{auth.message}</span>
          <button type="button" className="secondary" onClick={() => void checkSession()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (auth.status === "signedOut") {
    return (
      <AuthForm
        notice={auth.notice}
        demo={demo}
        onSubmit={async (mode, credentials) => {
          const user = mode === "login" ? await api.login(credentials) : await api.register(credentials);
          setAuth({ status: "signedIn", user });
        }}
      />
    );
  }

  return (
    <TaskBoard
      key={auth.user.id}
      user={auth.user}
      onSessionExpired={handleSessionExpired}
      onLogout={async () => {
        await api.logout();
        setAuth({ status: "signedOut", notice: "You're signed out." });
      }}
    />
  );
}
