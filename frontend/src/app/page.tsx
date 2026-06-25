"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  WifiOff,
  Trash2,
} from "lucide-react";
import SearchBar from "@/components/SearchBar";
import NewsCard from "@/components/NewsCard";
import SchedulerPanel from "@/components/SchedulerPanel";
import CrawlPanel from "@/components/CrawlPanel";
import LLMConfigAlert from "@/components/LLMConfigAlert";
import {
  fetchArticles,
  fetchArticleStats,
  addArticleToKnowledgeBase,
  deleteArticle,
  deleteAllArticles,
  type Article,
  type ArticleStats,
} from "@/lib/api";
import { isLLMConfigError } from "@/lib/errors";

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

  // LLM 配置错误状态
  const [kbLlmConfigError, setKbLlmConfigError] = useState(false);

  // 清空所有文章状态
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

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

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const data = await fetchArticleStats();
      setStats(data);
    } catch (err) {
      console.error("加载统计失败:", err);
    }
  }, []);

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
      // 刷新列表和统计，以获取后端自动生成的摘要等最新数据
      loadArticles(currentPage);
      loadStats();
    } catch (error) {
      console.error("添加到知识库失败:", error);
      if (isLLMConfigError(error)) {
        setKbLlmConfigError(true);
      } else {
        alert((error as Error).message);
      }
    }
  }, [loadArticles, currentPage, loadStats]);

  // 删除单篇文章
  const handleDelete = useCallback(async (articleId: number) => {
    try {
      await deleteArticle(articleId);
      // 从本地列表中移除
      setArticles((prev) => prev.filter((a) => a.id !== articleId));
      loadStats();
      // 如果当前页删空了，回到上一页
      if (articles.length <= 1 && currentPage > 1) {
        loadArticles(currentPage - 1);
      } else {
        loadArticles(currentPage);
      }
    } catch (error) {
      console.error("删除文章失败:", error);
      alert((error as Error).message);
    }
  }, [articles.length, currentPage, loadArticles, loadStats]);

  // 清空所有文章
  const handleDeleteAll = useCallback(async () => {
    if (!confirmDeleteAll) {
      setConfirmDeleteAll(true);
      return;
    }
    setDeletingAll(true);
    try {
      await deleteAllArticles();
      setArticles([]);
      setConfirmDeleteAll(false);
      setCurrentPage(1);
      loadArticles(1);
      loadStats();
    } catch (error) {
      console.error("清空文章失败:", error);
      alert((error as Error).message);
    } finally {
      setDeletingAll(false);
    }
  }, [confirmDeleteAll, loadArticles, loadStats]);

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

  // 爬取完成后刷新数据
  const handleCrawlComplete = useCallback(() => {
    loadArticles(currentPage);
    loadStats();
  }, [loadArticles, currentPage, loadStats]);

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

      {/* ---- 搜索栏 ---- */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSearch={handleSearch}
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* ---- 手动爬取面板 ---- */}
      <CrawlPanel onCrawlComplete={handleCrawlComplete} />

      {kbLlmConfigError && <LLMConfigAlert />}

      {/* ---- 文章列表工具栏 ---- */}
      {articles.length > 0 && !loading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            共 {stats?.total ?? 0} 篇文章
          </p>
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              confirmDeleteAll
                ? "bg-red-600 text-white hover:bg-red-700"
                : "border border-red-200 bg-white text-red-600 hover:bg-red-50"
            }`}
          >
            <Trash2 className="h-4 w-4" />
            {deletingAll
              ? "清空中..."
              : confirmDeleteAll
              ? "确认清空所有文章？"
              : "清空所有文章"}
          </button>
        </div>
      )}

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
              onDelete={handleDelete}
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
