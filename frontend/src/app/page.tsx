"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  BookPlus,
  BookCheck,
} from "lucide-react";
import SearchBar from "@/components/SearchBar";
import NewsCard from "@/components/NewsCard";
import SchedulerPanel from "@/components/SchedulerPanel";
import LLMConfigAlert from "@/components/LLMConfigAlert";
import {
  fetchArticles,
  triggerCrawl,
  fetchArticleStats,
  createCrawlWebSocket,
  addArticleToKnowledgeBase,
  type Article,
  type ArticleStats,
} from "@/lib/api";
import { isLLMConfigError } from "@/lib/errors";

interface CrawlProgress {
  current: string;
  processed: number;
  total: number;
  status: string;
}

export default function HomePage() {
  // 文章列表状态
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // 统计状态
  const [stats, setStats] = useState<ArticleStats | null>(null);

  // 搜索与筛选状态
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // 爬取状态
  const [crawling, setCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null);
  const [crawlComplete, setCrawlComplete] = useState<{
    total_new: number;
    total_summarized: number;
  } | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlLlmConfigError, setCrawlLlmConfigError] = useState(false);
  const [kbLlmConfigError, setKbLlmConfigError] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 加载文章列表
  const loadArticles = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const data = await fetchArticles(page, 20, searchQuery, statusFilter);
        setArticles(data.items);
        setTotalPages(data.pages);
        setCurrentPage(data.page);
      } catch (err) {
        console.error("加载文章失败:", err);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, statusFilter]
  );

  // 添加到知识库
  const handleAddToKnowledgeBase = useCallback(async (articleId: number) => {
    setKbLlmConfigError(false);
    try {
      await addArticleToKnowledgeBase(articleId);
      setArticles((prevArticles) =>
        prevArticles.map((article) =>
          article.id === articleId
            ? { ...article, is_in_knowledge_base: true }
            : article
        )
      );
    } catch (error) {
      console.error("添加到知识库失败:", error);
      if (isLLMConfigError(error)) {
        setKbLlmConfigError(true);
      } else {
        alert((error as Error).message);
      }
    }
  }, []);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const data = await fetchArticleStats();
      setStats(data);
    } catch (err) {
      console.error("加载统计失败:", err);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadArticles(1);
    loadStats();
  }, [loadArticles, loadStats]);

  // 搜索处理
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    loadArticles(1);
  }, [loadArticles]);

  const handleStatusChange = useCallback(
    (status: string) => {
      setStatusFilter(status);
      setCurrentPage(1);
    },
    []
  );

  // 状态筛选变化后重新加载
  useEffect(() => {
    loadArticles(1);
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // 分页
  const handlePageChange = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return;
      loadArticles(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [totalPages, loadArticles]
  );

  // 清理 WebSocket
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // 触发爬取
  const handleCrawl = useCallback(async () => {
    if (crawling) return;

    setCrawling(true);
    setCrawlProgress(null);
    setCrawlComplete(null);
    setCrawlError(null);
    setCrawlLlmConfigError(false);

    try {
      await triggerCrawl();

      // 建立 WebSocket 连接跟踪进度
      const ws = createCrawlWebSocket(
        (msg) => {
          switch (msg.type) {
            case "progress":
              setCrawlProgress(msg.data as unknown as CrawlProgress);
              break;
            case "complete":
              setCrawlComplete(
                msg.data as unknown as {
                  total_new: number;
                  total_summarized: number;
                }
              );
              setCrawlProgress(null);
              setCrawling(false);
              // 刷新列表和统计
              loadArticles(currentPage);
              loadStats();
              break;
            case "error": {
              const message = (msg.data as { message: string }).message;
              setCrawlError(message);
              setCrawlLlmConfigError(message.includes("请配置大模型密钥"));
              setCrawlProgress(null);
              setCrawling(false);
              break;
            }
          }
        },
        () => {
          console.log("WebSocket 已连接");
        },
        () => {
          setCrawling(false);
        }
      );

      wsRef.current = ws;
    } catch (err) {
      console.error("触发爬取失败:", err);
      setCrawlError("触发爬取失败，请稍后重试");
      setCrawling(false);
    }
  }, [crawling, currentPage, loadArticles, loadStats]);

  // 生成分页按钮
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }

    return (
      <div className="mt-8 flex items-center justify-center gap-1">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          上一页
        </button>
        {pages.map((p, i) =>
          typeof p === "string" ? (
            <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => handlePageChange(p)}
              className={`min-w-[36px] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                p === currentPage
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ---- 顶部统计栏 ---- */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "总计", value: stats?.total ?? 0, color: "bg-blue-50 text-blue-600" },
          { label: "已摘要", value: stats?.summarized ?? 0, color: "bg-green-50 text-green-600" },
          { label: "待处理", value: stats?.crawled ?? 0, color: "bg-amber-50 text-amber-600" },
          { label: "失败", value: stats?.failed ?? 0, color: "bg-red-50 text-red-600" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ---- 搜索栏 + 手动爬取按钮 ---- */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={handleSearch}
              statusFilter={statusFilter}
              onStatusChange={handleStatusChange}
            />
          </div>
          <button
            onClick={handleCrawl}
            disabled={crawling}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${crawling ? "animate-spin" : ""}`} />
            {crawling ? "爬取中..." : "手动爬取"}
          </button>
        </div>
      </div>

      {/* ---- 爬取进度面板 ---- */}
      {(crawlProgress || crawlComplete || crawlError) && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            {crawlError ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : crawlComplete ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Wifi className="h-5 w-5 text-blue-500 animate-pulse" />
            )}
            <h3 className="text-sm font-semibold text-gray-900">
              {crawlError ? "爬取出错" : crawlComplete ? "爬取完成" : "爬取进度"}
            </h3>
          </div>

          {crawlProgress && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                当前处理: <span className="font-medium text-gray-900">{crawlProgress.current}</span>
              </p>
              <p className="text-xs text-gray-500">
                已处理 {crawlProgress.processed} / {crawlProgress.total}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{
                    width: `${crawlProgress.total > 0 ? (crawlProgress.processed / crawlProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {crawlComplete && (
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                新增文章: <span className="font-semibold text-gray-900">{crawlComplete.total_new}</span> 篇
              </p>
              <p>
                已生成摘要: <span className="font-semibold text-gray-900">{crawlComplete.total_summarized}</span> 篇
              </p>
            </div>
          )}

          {crawlLlmConfigError ? (
            <LLMConfigAlert message={crawlError ?? undefined} />
          ) : (
            crawlError && <p className="text-sm text-red-600">{crawlError}</p>
          )}
        </div>
      )}

      {kbLlmConfigError && <LLMConfigAlert />}

      {/* ---- 新闻卡片网格 ---- */}
      {loading && articles.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-3 text-sm text-gray-500">加载中...</span>
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center shadow-sm">
          <WifiOff className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">暂无新闻数据</p>
          <p className="mt-1 text-xs text-gray-400">点击「手动爬取」开始获取新闻</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {articles.map((article) => (
            <NewsCard
              key={article.id}
              article={article}
              onAddToKnowledgeBase={handleAddToKnowledgeBase}
            />
          ))}
        </div>
      )}

      {/* ---- 分页控件 ---- */}
      {renderPagination()}

      {/* ---- 定时任务面板 ---- */}
      <SchedulerPanel />
    </div>
  );
}
