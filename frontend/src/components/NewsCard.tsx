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
  Trash2,
} from "lucide-react";
import type { Article } from "@/lib/api";

interface NewsCardProps {
  article: Article;
  onAddToKnowledgeBase: (articleId: number) => void;
  onDelete?: (articleId: number) => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  crawled: { label: "已爬取", color: "bg-blue-50 text-blue-600" },
  summarized: { label: "已摘要", color: "bg-green-50 text-green-600" },
  failed: { label: "失败", color: "bg-pink-50 text-pink-600" },
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

export default function NewsCard({ article, onAddToKnowledgeBase, onDelete }: NewsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete(article.id);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="group flex flex-col clay-card clay-card-hover p-6">
      <div className="flex-grow">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`clay-badge ${status.color}`}>
                <Tag className="mr-1 h-3 w-3" />
                {status.label}
              </span>
              {article.source && (
                <span className="text-xs text-gray-500">{article.source}</span>
              )}
            </div>
            <h3 className="line-clamp-2 text-base font-semibold text-[#5a4a42]">
              {article.title}
            </h3>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#b0a098]">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(article.crawled_at)}
            </div>
          </div>
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 rounded-lg p-1.5 text-[#b0a098] transition-colors hover:bg-gray-100 hover:text-[#7a6a62]"
              title="打开原文">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        {article.summary && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#7a6a62]">
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
                <li key={i} className="flex items-start gap-2 text-sm text-[#7a6a62]">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-300" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {article.impact && (
          <div className="mt-3 flex items-start gap-2 clay-inset p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
            <p className="text-sm text-amber-700">{article.impact}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between pt-4">
        <div className="flex items-center gap-2">
          {article.content && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-xs font-medium text-purple-500 transition-colors hover:text-purple-700">
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

        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                confirmDelete
                  ? "clay-btn bg-pink-200 text-pink-700"
                  : "clay-btn bg-pink-50 text-pink-500 hover:bg-pink-100"
              } disabled:opacity-50`}
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "删除中..." : confirmDelete ? "确认删除" : "删除"}
            </button>
          )}

          <button
            onClick={handleAdd}
            disabled={article.is_in_knowledge_base || isAdding}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              article.is_in_knowledge_base
                ? "cursor-default clay-btn bg-green-50 text-green-600"
                : "clay-btn bg-purple-50 text-purple-600"
            }`}>
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
      </div>

      {expanded && article.content && (
        <div className="mt-3 max-h-64 overflow-y-auto clay-inset p-4 text-sm leading-relaxed text-gray-700">
          {article.content}
        </div>
      )}
    </div>
  );
}
