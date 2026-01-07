import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Costume Stylist Virtual Try-On",
  description: "2D virtual try-on for costume styling",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        <main className="container mx-auto px-4 py-8 bg-white min-h-screen">{children}</main>
      </body>
    </html>
  );
}

