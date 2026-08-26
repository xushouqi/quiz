import type { Metadata, Viewport } from "next";
import { Baloo_2, Noto_Sans_SC, ZCOOL_KuaiLe } from "next/font/google";
import "./globals.css";
import { UserBar } from "@/components/layout/UserBar";
import { UserProvider } from "@/components/contexts/UserContext";
import { OfflineBootstrapper } from "@/components/OfflineBootstrapper";

const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin"] });
const noto = Noto_Sans_SC({ variable: "--font-noto", subsets: ["latin"] });
const kuaile = ZCOOL_KuaiLe({ variable: "--font-kuaile", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "跳跳的数学冒险 · 袋鼠数学练习",
  description: "袋鼠数学竞赛 Level 1-2 双语练习：闯关练习、模拟考试、错题本、星星奖励。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${baloo.variable} ${noto.variable} ${kuaile.variable}`}>
      <body className="min-h-dvh bg-sky-soft text-cocoa antialiased">
        <UserProvider>
          <OfflineBootstrapper />
          <UserBar />
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
