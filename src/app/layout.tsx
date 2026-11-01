import type { Metadata } from "next";
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
  title: "BatteryLab — Battery Design, Testing & Analysis System",
  description:
    "Design battery cells, configure series/parallel pack connections, build equivalent-circuit models, run discharge/charge/HPPC/drive simulations, execute thermal tests with the Bernardi heat model, and analyze every stored test run.",
  keywords: ["battery", "ECM", "equivalent circuit", "thermal testing", "HPPC", "pack design", "simulation", "analysis"],
  authors: [{ name: "BatteryLab" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Theme bootstrap — runs before first paint so a saved dark mode never flashes light.
  const themeBoot = `(function(){try{var t=localStorage.getItem("batterylab-theme");if(t==="dark"||(!t&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`;
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
