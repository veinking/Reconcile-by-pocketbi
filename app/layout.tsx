import type { Metadata } from "next";
import PocketBIAccount from "./components/PocketBIAccount";
import { PocketBIProvider } from "./components/PocketBIProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PocketBI Reconcile | Find what does not match",
  description: "Compare two CSV or Excel exports, find missing and changed records, and download a discrepancy report.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PocketBIProvider>
          {children}
          <PocketBIAccount />
        </PocketBIProvider>
      </body>
    </html>
  );
}
