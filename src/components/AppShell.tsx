"use client";

import { useRouter } from "next/navigation";
import { getPublicAppName } from "@/lib/public-config";

export function AppShell({
  children
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();

  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand" aria-label={getPublicAppName()}>
          <span className="brand-mark">ק</span>
          <span>{getPublicAppName()}</span>
        </div>
        <button className="secondary-button" type="button" onClick={logout}>
          יציאה
        </button>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
