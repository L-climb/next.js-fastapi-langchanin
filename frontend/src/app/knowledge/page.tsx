"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Brain, Database, Sparkles } from "lucide-react";
import {
  fetchKnowledgeStats,
  searchKnowledge,
  type KnowledgeStats,
  type SearchResult,
} from "@/lib/api";
import { isLLMConfigError } from "@/lib/errors";
import KnowledgeQuery from "@/components/KnowledgeQuery";
import LLMConfigAlert from "@/components/LLMConfigAlert";

type TabKey = "search" | "qa";

const TAB_ITEMS: { key: TabKey; label: string }[] = [
  { key: "search", label: "语义搜索" },
  { key: "qa", label: "AI 问答" },
];

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
  search: <Search className="h-4 w-4" />,
  qa: <Brain className="h-4 w-4" />,
};

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("search");
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
      {activeTab === "search" && <SearchPanel />}
      {activeTab === "qa" && <KnowledgeQuery />}
    </div>
  );
}

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
