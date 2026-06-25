"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Play, Trash2, RefreshCw, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { fetchSchedulerJobs, createSchedulerJob, deleteSchedulerJob } from "@/lib/api";

interface Job {
  id: string;
  name: string;
  trigger: string;
  next_run_time: string | null;
}

export default function SchedulerPanel() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [interval, setInterval] = useState(60);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSchedulerJobs();
      setJobs(data);
    } catch {
      console.error("加载任务列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded) loadJobs();
  }, [expanded, loadJobs]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createSchedulerJob({ interval_minutes: interval });
      await loadJobs();
    } catch {
      console.error("创建任务失败");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await deleteSchedulerJob(jobId);
      await loadJobs();
    } catch {
      console.error("删除任务失败");
    }
  };

  return (
    <div className="clay-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
            <Clock className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#5a4a42]">定时任务</h3>
            <p className="text-xs text-[#9a8a82]">
              {jobs.length > 0 ? `${jobs.length} 个任务运行中` : "暂无定时任务"}
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
        <div className="px-4 pb-4 pt-4">
          {/* 创建新任务 */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-[#b0a098]" />
              <span className="text-sm text-[#7a6a62]">每隔</span>
              <input
                type="number"
                min={5}
                max={1440}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-20 clay-input px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-sm text-[#7a6a62]">分钟</span>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-1.5 clay-btn bg-purple-400 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creating ? "创建中..." : "添加"}
            </button>
            <button
              onClick={loadJobs}
              disabled={loading}
              className="rounded-full p-1.5 text-[#b0a098] transition-colors hover:bg-purple-50 hover:text-purple-500"
              title="刷新"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* 任务列表 */}
          <div className="mt-4 space-y-2">
            {jobs.length === 0 && !loading && (
              <p className="py-4 text-center text-sm text-[#b0a098]">暂无定时任务，请添加</p>
            )}
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between clay-inset px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#5a4a42]">{job.name}</p>
                  <p className="text-xs text-[#9a8a82]">
                    {job.trigger}
                    {job.next_run_time &&
                      ` · 下次执行: ${new Date(job.next_run_time).toLocaleString("zh-CN")}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(job.id)}
                  className="ml-3 rounded-lg p-1.5 text-[#b0a098] transition-colors hover:bg-pink-50 hover:text-pink-500"
                  title="删除任务"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
