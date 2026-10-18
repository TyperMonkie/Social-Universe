import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PersonaVerse · 你的粒子宇宙",
  description: "把个人故事、兴趣与音乐变成一颗可以探索的粒子星球。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
