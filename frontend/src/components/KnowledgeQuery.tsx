"use client";

import { useState, useRef } from "react";
import { Search, Loader2, BookOpen, FileText, Send } from "lucide-react";
import { queryKnowledge, type QueryResponse } from "@/lib/api";
import { isLLMConfigError } from "@/lib/errors";
import LLMConfigAlert from "@/components/LLMConfigAlert";

export default function KnowledgeQuery() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [llmConfigError, setLlmConfigError] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setLlmConfigError(false);
    setResult(null);
    try {
      const data = await queryKnowledge(q);
      setResult(data);
    } catch (err) {
      if (isLLMConfigError(err)) {
        setLlmConfigError(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "查询失败，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatScore = (score: number) => {
    return Math.round(score * 100) + "%";
  };

  return (
    <div className="clay-card">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
          <BookOpen className="h-5 w-5 text-purple-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#5a4a42]">知识库问答</h3>
          <p className="text-xs text-[#9a8a82]">基于已有知识库进行 RAG 智能问答</p>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            rows={1}
            className="flex-1 resize-none clay-input px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-[#b0a098]"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !question.trim()}
            className="inline-flex items-center gap-1.5 clay-btn bg-purple-400 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {loading ? "查询中..." : "提问"}
          </button>
        </div>
      </div>

      {/* Error */}
      {llmConfigError && (
        <div className="mx-4 mb-4">
          <LLMConfigAlert />
        </div>
      )}
      {error && (
        <div className="mx-4 mb-4 clay-inset px-4 py-3 text-sm text-pink-600">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="border-t border-gray-100 px-4 pb-4">
          {/* AI Answer */}
          <div className="mt-4 clay-inset p-4">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-medium text-gray-700">AI 回答</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {result.answer}
            </p>
          </div>

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2">
                <Search className="h-4 w-4 text-[#9a8a82]" />
                <span className="text-xs font-medium text-gray-700">引用来源</span>
              </div>
              <div className="space-y-2">
                {result.sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between clay-inset p-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3 w-3 text-[#b0a098]" />
                      <span className="truncate text-sm font-medium text-gray-800">
                        {source.title}
                      </span>
                    </div>
                    <span className="shrink-0 clay-badge bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-600">
                      {formatScore(source.score)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
