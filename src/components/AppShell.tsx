"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getPublicAppName } from "@/lib/public-config";

type IconName =
  | "dashboard"
  | "patients"
  | "calendar"
  | "tasks"
  | "payments"
  | "files"
  | "settings";

const navItems: Array<{
  href: string;
  label: string;
  icon: IconName;
  badge?: string;
}> = [
  { href: "/dashboard", label: "דשבורד", icon: "dashboard" },
  { href: "/patients", label: "מטופלים", icon: "patients" },
  { href: "/calendar", label: "יומן", icon: "calendar", badge: "0" },
  { href: "/tasks", label: "משימות", icon: "tasks", badge: "0" },
  { href: "/payments", label: "תשלומים", icon: "payments", badge: "0" },
  { href: "/files", label: "קבצים", icon: "files" },
  { href: "/settings", label: "הגדרות", icon: "settings" }
];

function SideIcon({ name }: { name: IconName }): React.ReactElement {
  const common = {
    "aria-hidden": true,
    fill: "none",
    focusable: false,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24"
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <path d="M4 13a8 8 0 0 1 16 0" />
          <path d="M12 13l4-4" />
          <path d="M6.5 19h11" />
        </svg>
      );
    case "patients":
      return (
        <svg {...common}>
          <path d="M16 19v-1a4 4 0 0 0-8 0v1" />
          <circle cx="12" cy="8" r="3" />
          <path d="M19 19v-1.2a3 3 0 0 0-2-2.8" />
          <path d="M17 5.4a2.5 2.5 0 0 1 0 5.2" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect height="16" rx="2" width="18" x="3" y="5" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M3 10h18" />
        </svg>
      );
    case "tasks":
      return (
        <svg {...common}>
          <path d="M9 6h11" />
          <path d="M9 12h11" />
          <path d="M9 18h11" />
          <path d="M4 6l1 1 2-2" />
          <path d="M4 12l1 1 2-2" />
          <path d="M4 18l1 1 2-2" />
        </svg>
      );
    case "payments":
      return (
        <svg {...common}>
          <rect height="14" rx="2" width="18" x="3" y="5" />
          <path d="M3 10h18" />
          <path d="M7 15h4" />
        </svg>
      );
    case "files":
      return (
        <svg {...common}>
          <path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.8 1.8 0 0 0 .4 2l.1.1-2 3.4-.2-.1a1.8 1.8 0 0 0-2.1.4l-.1.1h-4l-.1-.1a1.8 1.8 0 0 0-2.1-.4l-.2.1-2-3.4.1-.1a1.8 1.8 0 0 0 .4-2" />
          <path d="M4.6 9a1.8 1.8 0 0 0-.4-2l-.1-.1 2-3.4.2.1a1.8 1.8 0 0 0 2.1-.4l.1-.1h4l.1.1a1.8 1.8 0 0 0 2.1.4l.2-.1 2 3.4-.1.1a1.8 1.8 0 0 0-.4 2" />
        </svg>
      );
  }
}

export function AppShell({
  children
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();

  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <main className="app-main">{children}</main>

      <aside className="side-nav" aria-label="ניווט ראשי">
        <div className="side-brand" aria-label={getPublicAppName()}>
          <span className="side-brand-mark">קל</span>
          <span>{getPublicAppName()}</span>
        </div>

        <nav className="side-menu">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "side-link active" : "side-link"}
                href={item.href}
                key={item.href}
              >
                <span className="side-glyph">
                  <SideIcon name={item.icon} />
                </span>
                <span>{item.label}</span>
                {item.badge ? <span className="side-badge">{item.badge}</span> : null}
              </Link>
            );
          })}
        </nav>

        <button className="side-logout" type="button" onClick={logout}>
          יציאה
        </button>
      </aside>
    </div>
  );
}
