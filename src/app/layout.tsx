import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recruiter tool — checklists & bill-to-pay calculator",
  description:
    "Healthcare recruiter toolkit: skills checklists for RN/LPN/CNA/PT/OT/RT candidates and a bill-to-pay staffing margin & stipend split calculator.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%231a2a6c'/%3E%3Crect x='22' y='14' width='56' height='72' rx='8' fill='white'/%3E%3Crect x='32' y='10' width='14' height='10' rx='3' fill='%234f46e5'/%3E%3Crect x='54' y='10' width='14' height='10' rx='3' fill='%234f46e5'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
