import { parseApiError, LLM_CONFIG_MESSAGE, isLLMConfigError } from "@/lib/errors";

export { LLM_CONFIG_MESSAGE, isLLMConfigError };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export interface Article {
  id: number;
  title: string;
  url: string;
  source: string;
  content: string;
  summary: string | null;
  summary_points: string[] | null;
  impact: string | null;
  crawled_at: string;
  summarized_at: string | null;
  status: "crawled" | "summarized" | "failed";
  is_in_knowledge_base: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ArticleStats {
  total: number;
  summarized: number;
  crawled: number;
  failed: number;
}

export interface KnowledgeStats {
  total_documents: number;
  [key: string]: unknown;
}

export interface SearchResult {
  id: string;
  title: string;
  summary: string;
  score: number;
  content: string;
}

export interface QueryResponse {
  answer: string;
  sources: { title: string; url: string; score: number }[];
}

export interface SchedulerJob {
  job_id: string;
  name: string;
  trigger: string;
  next_run_time: string;
  [key: string]: unknown;
}

export interface LLMConfig {
  provider: string;
  api_key: string | null;
  base_url: string | null;
  chat_model: string;
  embedding_model: string | null;
}

export async function fetchArticles(
  page = 1,
  size = 20,
  search = "",
  status = ""
): Promise<PaginatedResponse<Article>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  const res = await fetch(`${API_BASE}/api/articles?${params}`);
  if (!res.ok) throw new Error("获取文章列表失败");
  const data: PaginatedResponse<Article> = await res.json();
  // 后端 summary_points 存为 JSON 字符串，前端需要数组
  data.items = data.items.map((item) => ({
    ...item,
    summary_points: typeof item.summary_points === "string"
      ? JSON.parse(item.summary_points)
      : item.summary_points,
  }));
  return data;
}

export async function fetchArticle(id: number): Promise<Article> {
  const res = await fetch(`${API_BASE}/api/articles/${id}`);
  if (!res.ok) throw new Error("获取文章详情失败");
  const item: Article = await res.json();
  if (typeof item.summary_points === "string") {
    item.summary_points = JSON.parse(item.summary_points);
  }
  return item;
}

export async function addArticleToKnowledgeBase(
  articleId: number
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/articles/${articleId}/knowledge`, {
    method: "POST",
  });
  if (!res.ok) {
    throw await parseApiError(res, "添加到知识库失败");
  }
  return res.json();
}

export async function triggerCrawl(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/articles/crawl`, { method: "POST" });
  if (!res.ok) throw new Error("触发爬取失败");
  return res.json();
}

export async function fetchArticleStats(): Promise<ArticleStats> {
  const res = await fetch(`${API_BASE}/api/articles/stats`);
  if (!res.ok) throw new Error("获取统计失败");
  return res.json();
}

export async function searchKnowledge(
  query: string,
  limit = 5
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await fetch(`${API_BASE}/api/knowledge/search?${params}`);
  if (!res.ok) throw await parseApiError(res, "知识库搜索失败");
  const data = await res.json();
  // 后端返回 {query, results: [{id, document, metadata, distance}]}
  // 前端期望 [{id, title, summary, score, content}]
  const raw = data.results ?? data;
  return raw.map(
    (r: { id: string; document: string; metadata?: { title?: string }; distance?: number }) => ({
      id: r.id,
      title: r.metadata?.title ?? "未知",
      summary: r.document ?? "",
      score: r.distance ?? 0,
      content: r.document ?? "",
    })
  );
}

export async function queryKnowledge(
  question: string,
  nResults = 5
): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE}/api/knowledge/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, n_results: nResults }),
  });
  if (!res.ok) throw await parseApiError(res, "知识库问答失败");
  const data = await res.json();
  // 后端 sources 格式: [{id, document, metadata: {article_id, title}, distance}]
  // 前端期望: [{title, url, score}]
  if (data.sources) {
    data.sources = data.sources.map(
      (s: { metadata?: { title?: string; article_id?: number }; distance?: number }) => ({
        title: s.metadata?.title ?? "未知来源",
        url: "",
        score: s.distance ?? 0,
      })
    );
  }
  return data;
}

export async function fetchKnowledgeStats(): Promise<KnowledgeStats> {
  const res = await fetch(`${API_BASE}/api/knowledge/stats`);
  if (!res.ok) throw new Error("获取知识库统计失败");
  return res.json();
}

export async function fetchSchedulerJobs(): Promise<SchedulerJob[]> {
  const res = await fetch(`${API_BASE}/api/scheduler/jobs`);
  if (!res.ok) throw new Error("获取任务列表失败");
  return res.json();
}

export async function createSchedulerJob(
  job: Record<string, unknown>
): Promise<SchedulerJob> {
  const res = await fetch(`${API_BASE}/api/scheduler/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
  });
  if (!res.ok) throw new Error("创建任务失败");
  return res.json();
}

export async function deleteSchedulerJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/scheduler/jobs/${jobId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("删除任务失败");
}

export async function getLLMConfig(): Promise<LLMConfig> {
  const res = await fetch(`${API_BASE}/api/config/llm`);
  if (!res.ok) throw new Error("获取 LLM 配置失败");
  return res.json();
}

export async function updateLLMConfig(config: LLMConfig): Promise<LLMConfig> {
  const res = await fetch(`${API_BASE}/api/config/llm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "更新 LLM 配置失败");
  }
  return res.json();
}

export function createCrawlWebSocket(
  onMessage: (data: { type: string; data: Record<string, unknown> }) => void,
  onOpen?: () => void,
  onClose?: () => void
): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/ws/crawl-progress`);
  ws.onopen = () => onOpen?.();
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch {
      // ignore non-JSON messages
    }
  };
  ws.onclose = () => onClose?.();
  return ws;
}
