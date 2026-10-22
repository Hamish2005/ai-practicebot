import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Practice Bot | MSWorx Learning",
  description: "Build confidence, one conversation at a time.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
