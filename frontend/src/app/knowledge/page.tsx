"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Brain,
  Database,
  Sparkles,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  BookOpen,
  Puzzle,
} from "lucide-react";
import {
  fetchKnowledgeStats,
  fetchKnowledgeDocuments,
  fetchKnowledgeDocument,
  type KnowledgeStats,
  type SearchResult,
  searchKnowledge,
  type KnowledgeDocumentItem,
  type KnowledgeDocumentDetail,
} from "@/lib/api";
import { isLLMConfigError } from "@/lib/errors";
import KnowledgeQuery from "@/components/KnowledgeQuery";
import LLMConfigAlert from "@/components/LLMConfigAlert";

type TabKey = "documents" | "search" | "qa";

const TAB_ITEMS: { key: TabKey; label: string }[] = [
  { key: "documents", label: "文档列表" },
  { key: "search", label: "语义搜索" },
  { key: "qa", label: "AI 问答" },
];

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
  documents: <FileText className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  qa: <Brain className="h-4 w-4" />,
};

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("documents");
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchKnowledgeStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900">
          <Database className="h-8 w-8 text-indigo-600" />
          知识库
        </h1>
        <p className="mt-2 text-gray-500">基于向量检索的语义搜索与 AI 智能问答</p>
      </div>

      {/* Stats Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {statsLoading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
            加载统计中...
          </div>
        ) : stats ? (
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
              <Sparkles className="h-7 w-7 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">知识库文档总数</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total_documents}</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">暂无统计数据</p>
        )}
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {TAB_ICONS[tab.key]}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "documents" && <DocumentListPanel />}
      {activeTab === "search" && <SearchPanel />}
      {activeTab === "qa" && <KnowledgeQuery />}
    </div>
  );
}

/* ==================== 文档列表面板 ==================== */

function DocumentListPanel() {
  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [llmConfigError, setLlmConfigError] = useState(false);

  // 详情弹窗
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [detail, setDetail] = useState<KnowledgeDocumentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDocuments = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    setLlmConfigError(false);
    try {
      const data = await fetchKnowledgeDocuments(p, 20);
      setDocuments(data.items);
      setTotalPages(data.pages);
      setTotal(data.total);
    } catch (err) {
      setDocuments([]);
      if (isLLMConfigError(err)) {
        setLlmConfigError(true);
      } else {
        setError(err instanceof Error ? err.message : "加载文档列表失败");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments(page);
  }, [page, loadDocuments]);

  const handleOpenDetail = async (item: KnowledgeDocumentItem) => {
    if (item.article_id == null) return;
    setSelectedArticleId(item.article_id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await fetchKnowledgeDocument(item.article_id);
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedArticleId(null);
    setDetail(null);
  };

  return (
    <>
      <div className="space-y-4">
        {llmConfigError && <LLMConfigAlert />}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
          </div>
        ) : documents.length === 0 && !llmConfigError && !error ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 py-16 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-gray-500">知识库中暂无文档</p>
            <p className="mt-1 text-sm text-gray-400">请先在新闻列表中将文章加入知识库</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              共 {total} 篇文档，第 {page}/{totalPages} 页
            </p>
            <div className="space-y-2">
              {documents.map((item) => (
                <button
                  key={item.doc_id}
                  onClick={() => handleOpenDetail(item)}
                  className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                    <FileText className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-gray-900">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-400">
                      ID: {item.article_id ?? "-"} &middot; {item.doc_id}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
                </button>
              ))}
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </button>
                <span className="text-sm text-gray-500">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedArticleId !== null && (
        <DocumentDetailModal
          detail={detail}
          loading={detailLoading}
          onClose={handleCloseDetail}
        />
      )}
    </>
  );
}

/* ==================== 文档详情弹窗 ==================== */

const CHUNK_TYPE_COLORS: Record<string, string> = {
  标题: "bg-purple-50 text-purple-700 border-purple-200",
  摘要: "bg-blue-50 text-blue-700 border-blue-200",
  要点: "bg-amber-50 text-amber-700 border-amber-200",
  影响分析: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function getChunkColor(chunkType: string): string {
  // 精确匹配
  if (CHUNK_TYPE_COLORS[chunkType]) return CHUNK_TYPE_COLORS[chunkType];
  // 模糊匹配 "要点 1", "要点 2" 等
  if (chunkType.startsWith("要点")) return CHUNK_TYPE_COLORS["要点"];
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function DocumentDetailModal({
  detail,
  loading,
  onClose,
}: {
  detail: KnowledgeDocumentDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* 头部 */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-indigo-600" />
              <span className="text-xs font-medium text-indigo-600">文档切块详情</span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-gray-900 leading-snug">
              {detail?.title ?? "加载中..."}
            </h2>
            {detail?.article_id != null && (
              <p className="mt-1 text-xs text-gray-400">Article ID: {detail.article_id}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: "calc(85vh - 100px)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Puzzle className="h-4 w-4" />
                <span>共 {detail.chunks.length} 个切块</span>
              </div>

              {detail.chunks.map((chunk, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                >
                  <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 bg-gray-50/50">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getChunkColor(chunk.chunk_type)}`}
                    >
                      {chunk.chunk_type}
                    </span>
                    <span className="text-xs text-gray-400">#{idx + 1}</span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                      {chunk.content}
                    </p>
                  </div>
                </div>
              ))}

              {/* 原始文档全文 */}
              <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4">
                <p className="mb-2 text-xs font-medium text-gray-400">原始文档全文</p>
                <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">
                  {detail.document}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-gray-400">
              加载文档详情失败
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== 搜索面板（保持不变） ==================== */

function SearchPanel() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [llmConfigError, setLlmConfigError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!q.trim()) return;
    setSearching(true);
    setSearched(true);
    setLlmConfigError(false);
    setError(null);
    try {
      const data = await searchKnowledge(q.trim(), 10);
      setResults(data);
    } catch (err) {
      setResults([]);
      if (isLLMConfigError(err)) {
        setLlmConfigError(true);
      } else {
        setError(err instanceof Error ? err.message : "搜索失败，请稍后重试");
      }
    } finally {
      setSearching(false);
    }
  }, [q]);

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="输入关键词进行语义搜索..."
            className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || !q.trim()}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {searching ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          搜索
        </button>
      </div>

      {llmConfigError && <LLMConfigAlert />}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {searching && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
        </div>
      )}

      {!searching && searched && results.length === 0 && !llmConfigError && !error && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center text-gray-500">
          未找到相关结果，请尝试其他关键词
        </div>
      )}

      {!searching && results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">找到 {results.length} 条相关结果</p>
          {results.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.summary}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-700">
                    {(item.score * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
