"use client";

import { Search, Filter } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  statusFilter?: string;
  onStatusChange?: (status: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  onSearch,
  statusFilter,
  onStatusChange,
  placeholder = "搜索新闻...",
}: SearchBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b0a098]" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full clay-input py-2.5 pl-10 pr-4 text-sm text-[#5a4a42] placeholder-gray-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      {onStatusChange && (
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b0a098]" />
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="appearance-none clay-input py-2.5 pl-10 pr-8 text-sm text-[#7a6a62] outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">全部状态</option>
            <option value="crawled">已爬取</option>
            <option value="summarized">已摘要</option>
            <option value="failed">失败</option>
          </select>
        </div>
      )}
      <button
        onClick={onSearch}
        className="inline-flex items-center justify-center gap-2 clay-btn bg-purple-400 px-6 py-2.5 text-sm font-medium text-white"
      >
        <Search className="h-4 w-4" />
        搜索
      </button>
    </div>
  );
}
