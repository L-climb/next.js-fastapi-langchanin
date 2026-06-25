"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw,
  Wifi,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Globe,
  Rss,
  X,
} from "lucide-react";
import LLMConfigAlert from "@/components/LLMConfigAlert";
import {
  fetchSources,
  createSource,
  deleteSource,
  triggerCrawl,
  createCrawlWebSocket,
  type CrawlSource,
} from "@/lib/api";

interface CrawlProgress {
  current: string;
  processed: number;
  total: number;
  status: string;
}

interface CrawlPanelProps {
  onCrawlComplete?: () => void;
}

export default function CrawlPanel({ onCrawlComplete }: CrawlPanelProps) {
  // 源列表
  const [sources, setSources] = useState<CrawlSource[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingSources, setLoadingSources] = useState(false);

  // 添加自定义源表单
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState("ai");
  const [addingSource, setAddingSource] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // 爬取参数
  const [maxCount, setMaxCount] = useState<number | "">("");
  const [topic, setTopic] = useState("");
  const [expanded, setExpanded] = useState(false);

  // 爬取状态
  const [crawling, setCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null);
  const [crawlComplete, setCrawlComplete] = useState<{
    total_new: number;
    total_summarized: number;
  } | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlLlmConfigError, setCrawlLlmConfigError] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 加载源列表
  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const data = await fetchSources();
      setSources(data);
      // 首次加载时默认全选
      if (selectedIds.size === 0 && data.length > 0) {
        setSelectedIds(new Set(data.map((s) => s.id)));
      }
    } catch (err) {
      console.error("加载源列表失败:", err);
    } finally {
      setLoadingSources(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // 选择/取消选择
  const toggleSource = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(sources.map((s) => s.id)));
  }, [sources]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // 添加自定义源
  const handleAddSource = useCallback(async () => {
    if (!newName.trim() || !newUrl.trim()) {
      setAddError("名称和 URL 不能为空");
      return;
    }
    setAddingSource(true);
    setAddError(null);
    try {
      const created = await createSource({
        name: newName.trim(),
        url: newUrl.trim(),
        category: newCategory || "ai",
      });
      setSources((prev) => [...prev, created]);
      setSelectedIds((prev) => new Set([...Array.from(prev), created.id]));
      setNewName("");
      setNewUrl("");
      setNewCategory("ai");
      setShowAddForm(false);
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAddingSource(false);
    }
  }, [newName, newUrl, newCategory]);

  // 删除自定义源
  const handleDeleteSource = useCallback(
    async (id: number) => {
      try {
        await deleteSource(id);
        setSources((prev) => prev.filter((s) => s.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch (err) {
        alert((err as Error).message);
      }
    },
    []
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
    if (selectedIds.size === 0) {
      alert("请至少选择一个爬取源");
      return;
    }

    setCrawling(true);
    setCrawlProgress(null);
    setCrawlComplete(null);
    setCrawlError(null);
    setCrawlLlmConfigError(false);

    try {
      const params: { source_ids?: number[]; max_count?: number; topic?: string } = {
        source_ids: Array.from(selectedIds),
      };
      if (maxCount !== "" && maxCount > 0) {
        params.max_count = Number(maxCount);
      }
      if (topic.trim()) {
        params.topic = topic.trim();
      }

      await triggerCrawl(params);

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
              onCrawlComplete?.();
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
  }, [crawling, selectedIds, maxCount, topic, onCrawlComplete]);

  const allSelected = sources.length > 0 && selectedIds.size === sources.length;
  const presetSources = sources.filter((s) => s.is_preset);
  const customSources = sources.filter((s) => !s.is_preset);

  return (
    <div className="clay-card">
      {/* 折叠头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
            <Rss className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#5a4a42]">手动爬取</h3>
            <p className="text-xs text-[#9a8a82]">
              {sources.length > 0
                ? `已选 ${selectedIds.size} / ${sources.length} 个源`
                : "加载中..."}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-[#b0a098]" />
        ) : (
          <ChevronDown className="h-5 w-5 text-[#b0a098]" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5">
          {/* 快捷操作 */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={selectAll}
              disabled={allSelected || loadingSources}
              className="rounded-md px-3 py-1 text-xs font-medium text-[#7a6a62] transition-colors hover:bg-gray-100 disabled:opacity-40"
            >
              全选
            </button>
            <button
              onClick={selectNone}
              disabled={selectedIds.size === 0 || loadingSources}
              className="rounded-md px-3 py-1 text-xs font-medium text-[#7a6a62] transition-colors hover:bg-gray-100 disabled:opacity-40"
            >
              全不选
            </button>
            <div className="mx-2 h-4 w-px bg-gray-200" />
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              <Plus className="h-3 w-3" />
              添加自定义源
            </button>
            <button
              onClick={loadSources}
              disabled={loadingSources}
              className="ml-auto rounded-md p-1 text-[#b0a098] transition-colors hover:bg-gray-100 hover:text-[#7a6a62]"
              title="刷新源列表"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingSources ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* 添加自定义源表单 */}
          {showAddForm && (
            <div className="mt-3 clay-inset p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">添加 RSS 源</span>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setAddError(null);
                  }}
                  className="rounded p-0.5 text-[#b0a098] hover:text-[#7a6a62]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="名称（如 OpenAI Blog）"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full clay-input px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="url"
                  placeholder="RSS Feed URL（https://...）"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full clay-input px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="分类（默认 ai）"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-32 clay-input px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    onClick={handleAddSource}
                    disabled={addingSource}
                    className="inline-flex items-center gap-1.5 clay-btn bg-purple-400 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    {addingSource ? "添加中..." : "添加"}
                  </button>
                </div>
              </div>
              {addError && (
                <p className="mt-2 flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {addError}
                </p>
              )}
            </div>
          )}

          {/* 源列表 */}
          <div className="mt-4 space-y-4">
            {/* 预设源 */}
            {presetSources.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#b0a098]">
                  预设源
                </p>
                <div className="space-y-1">
                  {presetSources.map((source) => (
                    <label
                      key={source.id}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-purple-50/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(source.id)}
                        onChange={() => toggleSource(source.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Globe className="h-4 w-4 flex-shrink-0 text-[#b0a098]" />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-[#5a4a42]">{source.name}</span>
                        <span className="ml-2 clay-badge bg-purple-50 px-1.5 py-0.5 text-xs text-purple-500">
                          {source.category}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 自定义源 */}
            {customSources.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#b0a098]">
                  自定义源
                </p>
                <div className="space-y-1">
                  {customSources.map((source) => (
                    <label
                      key={source.id}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-purple-50/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(source.id)}
                        onChange={() => toggleSource(source.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Globe className="h-4 w-4 flex-shrink-0 text-blue-400" />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-[#5a4a42]">{source.name}</span>
                        <span className="ml-2 clay-badge bg-purple-50 px-1.5 py-0.5 text-xs text-purple-500">
                          {source.category}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteSource(source.id);
                        }}
                        className="flex-shrink-0 rounded p-1 text-[#b0a098] transition-colors hover:bg-red-50 hover:text-red-500"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {sources.length === 0 && !loadingSources && (
              <p className="py-4 text-center text-sm text-[#b0a098]">暂无 RSS 源，请添加</p>
            )}
          </div>

          {/* 主题过滤 */}
          <div className="mt-5 border-t border-gray-100 pt-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <svg className="h-4 w-4 text-[#b0a098]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
              </svg>
              主题筛选
              <span className="text-xs font-normal text-[#b0a098]">（可选，留空则不过滤）</span>
            </label>
            <input
              type="text"
              placeholder="输入主题关键词，如 AI、篮球、量子计算..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full clay-input px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            {topic.trim() && (
              <p className="mt-1.5 text-xs text-blue-600">
                将使用 LLM 智能筛选与「{topic.trim()}」相关的文章
              </p>
            )}
          </div>

          {/* 爬取参数 + 按钮 */}
          <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#7a6a62]">每源最多</span>
              <input
                type="number"
                min={1}
                max={100}
                placeholder="不限"
                value={maxCount}
                onChange={(e) =>
                  setMaxCount(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-20 clay-input px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-sm text-[#7a6a62]">篇</span>
            </div>
            <button
              onClick={handleCrawl}
              disabled={crawling || selectedIds.size === 0}
              className="ml-auto inline-flex items-center gap-2 clay-btn bg-purple-400 px-6 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${crawling ? "animate-spin" : ""}`} />
              {crawling ? "爬取中..." : "开始爬取"}
            </button>
          </div>

          {/* 爬取进度 */}
          {(crawlProgress || crawlComplete || crawlError) && (
            <div className="mt-4 clay-inset p-4">
              <div className="mb-2 flex items-center gap-2">
                {crawlError ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : crawlComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Wifi className="h-4 w-4 animate-pulse text-blue-500" />
                )}
                <span className="text-sm font-medium text-[#5a4a42]">
                  {crawlError ? "爬取出错" : crawlComplete ? "爬取完成" : "爬取进度"}
                </span>
              </div>

              {crawlProgress && (
                <div className="space-y-2">
                  <p className="truncate text-sm text-[#7a6a62]">
                    当前: <span className="font-medium text-[#5a4a42]">{crawlProgress.current}</span>
                  </p>
                  <p className="text-xs text-[#9a8a82]">
                    已处理 {crawlProgress.processed} / {crawlProgress.total}
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-purple-100">
                    <div
                      className="h-full rounded-full bg-purple-400 transition-all duration-500"
                      style={{
                        width: `${crawlProgress.total > 0 ? (crawlProgress.processed / crawlProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {crawlComplete && (
                <div className="space-y-1 text-sm text-[#7a6a62]">
                  <p>
                    新增文章:{" "}
                    <span className="font-semibold text-[#5a4a42]">
                      {crawlComplete.total_new}
                    </span>{" "}
                    篇
                  </p>
                  <p>
                    已生成摘要:{" "}
                    <span className="font-semibold text-[#5a4a42]">
                      {crawlComplete.total_summarized}
                    </span>{" "}
                    篇
                  </p>
                </div>
              )}

              {crawlLlmConfigError ? (
                <div className="mt-2">
                  <LLMConfigAlert message={crawlError ?? undefined} />
                </div>
              ) : (
                crawlError && <p className="text-sm text-red-600">{crawlError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
