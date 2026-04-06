// src/LoginPage.tsx
import * as React from "react";
import { useLogin, Notification } from "react-admin";

export default function LoginPage() {
  const login = useLogin();
  const [loading, setLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ username: email, password }); // appelle authProvider.login
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      await login({ provider: "google" }); // appelle authProvider.login
    } catch (err) {
      alert((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", padding: 16 }}>
      <form onSubmit={handleSubmit} style={{ width: 320, display: "grid", gap: 12 }}>
        <h2>MOOD — Admin</h2>

        <button type="button" onClick={handleGoogleLogin} disabled={loading} style={{ padding: 10, borderRadius: 6 }}>
          {loading ? "Redirection…" : "Se connecter avec Google"}
        </button>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
          />
        </label>

        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
          />
        </label>

        <button type="submit" disabled={loading} style={{ padding: 10, borderRadius: 6 }}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <Notification />
    </div>
  );
}
