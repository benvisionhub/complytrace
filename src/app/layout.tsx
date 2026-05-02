import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComplyTrace | Metadata-only audit trails for fintech AI agents",
  description: "Compliance-grade policy logs, redaction evidence, human approvals, and audit packs without customer financial data.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
