import type { Metadata } from "next";
import "./globals.css";
import { getPublicAppName } from "@/lib/public-config";

export const metadata: Metadata = {
  title: getPublicAppName(),
  description: "מערכת פרטית לניהול קליניקה"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
