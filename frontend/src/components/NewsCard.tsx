"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  Tag,
  FileText,
  Lightbulb,
  AlertTriangle,
  BookPlus,
  BookCheck,
} from "lucide-react";
import type { Article } from "@/lib/api";

interface NewsCardProps {
  article: Article;
  onAddToKnowledgeBase: (articleId: number) => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  crawled: { label: "已爬取", color: "bg-blue-100 text-blue-700" },
  summarized: { label: "已摘要", color: "bg-green-100 text-green-700" },
  failed: { label: "失败", color: "bg-red-100 text-red-700" },
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NewsCard({ article, onAddToKnowledgeBase }: NewsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const status = statusConfig[article.status] || statusConfig.crawled;

  const handleAdd = async () => {
    if (article.is_in_knowledge_base || isAdding) return;
    setIsAdding(true);
    try {
      await onAddToKnowledgeBase(article.id);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex-grow">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                <Tag className="mr-1 h-3 w-3" />
                {status.label}
              </span>
              {article.source && (
                <span className="text-xs text-gray-500">{article.source}</span>
              )}
            </div>
            <h3 className="line-clamp-2 text-base font-semibold text-gray-900">
              {article.title}
            </h3>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(article.crawled_at)}
            </div>
          </div>
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title="打开原文">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        {article.summary && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-600">
            {article.summary}
          </p>
        )}

        {article.summary_points && article.summary_points.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Lightbulb className="h-3.5 w-3.5" />
              要点
            </div>
            <ul className="mt-1.5 space-y-1">
              {article.summary_points.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {article.impact && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
            <p className="text-sm text-amber-800">{article.impact}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2">
          {article.content && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 transition-colors hover:text-blue-800">
              <FileText className="h-3.5 w-3.5" />
              {expanded ? "收起全文" : "展开全文"}
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>

        <button
          onClick={handleAdd}
          disabled={article.is_in_knowledge_base || isAdding}
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:bg-green-50 disabled:text-green-700">
          {article.is_in_knowledge_base ? (
            <BookCheck className="h-4 w-4" />
          ) : (
            <BookPlus className="h-4 w-4" />
          )}
          {isAdding
            ? "添加中..."
            : article.is_in_knowledge_base
            ? "已在库中"
            : "加入知识库"}
        </button>
      </div>

      {expanded && article.content && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-700">
          {article.content}
        </div>
      )}
    </div>
  );
}
