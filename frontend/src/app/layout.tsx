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
      <body className="bg-gray-50 text-gray-900 antialiased">
        <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <a href="/" className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <span className="text-2xl">🤖</span>
              <span>AI 新闻智能平台</span>
            </a>
            <div className="flex items-center gap-6">
              <a
                href="/"
                className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
              >
                新闻列表
              </a>
              <a
                href="/knowledge"
                className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
              >
                知识库
              </a>
              <a
                href="/settings"
                className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
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
