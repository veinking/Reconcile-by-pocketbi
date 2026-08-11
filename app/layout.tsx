import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PocketBI Reconcile | Find what does not match",
  description: "Compare two CSV or Excel exports, find missing and changed records, and download a discrepancy report.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
