import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web Table Extractor",
  description: "Extract tables from public webpages into structured data.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
