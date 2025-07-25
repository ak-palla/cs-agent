import type { Metadata } from "next";
import type { Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Sidebar from "@/components/Sidebar";
import ZoomFix from "@/components/ZoomFix";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "CS Agent Dashboard",
  description: "Multi-platform chat and project management dashboard",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={`${geistSans.className} antialiased min-h-screen`}>
        <WebSocketProvider>
          <NotificationProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
            <div className="flex h-screen zoom-reset">
              <Sidebar />
              <main className="flex-1 overflow-hidden responsive-container">
                {children}
              </main>
              <ZoomFix />
            </div>
            </ThemeProvider>
          </NotificationProvider>
        </WebSocketProvider>
      </body>
    </html>
  );
}
