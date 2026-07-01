"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getPublicAppName } from "@/lib/public-config";

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message || "לא ניתן היה לבצע כניסה כרגע.");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="eyebrow">מערכת פרטית</p>
        <h1 id="login-title">{getPublicAppName()}</h1>
        <p>כניסה מאובטחת לניהול הקליניקה.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="password">סיסמה</label>
            <input
              autoComplete="current-password"
              id="password"
              minLength={1}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </div>

          {error ? <div className="form-error">{error}</div> : null}

          <button
            className="primary-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "בודק..." : "כניסה"}
          </button>
        </form>
      </section>
    </main>
  );
}
