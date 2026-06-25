import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 新闻智能平台",
  description: "自动爬取 AI 前沿新闻，智能摘要，知识库管理",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <nav className="clay-nav sticky top-0 z-50">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <a href="/" className="flex items-center gap-2 text-xl font-bold text-[#5a4a42]">
              <span className="text-2xl">🤖</span>
              <span>AI 新闻智能平台</span>
            </a>
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="clay-badge bg-purple-50 px-4 py-2 text-sm font-medium text-purple-600 transition-all hover:bg-purple-100"
              >
                新闻列表
              </a>
              <a
                href="/knowledge"
                className="clay-badge bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition-all hover:bg-blue-100"
              >
                知识库
              </a>
              <a
                href="/settings"
                className="clay-badge bg-amber-50 px-4 py-2 text-sm font-medium text-amber-600 transition-all hover:bg-amber-100"
              >
                模型配置
              </a>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
