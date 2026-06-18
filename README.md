# 🤖 AI 新闻智能平台

自动爬取 AI 前沿新闻，利用大模型生成摘要，构建可语义检索的知识库。

## 技术栈

- **前端**: Next.js 14 + TypeScript + Tailwind CSS
- **后端**: FastAPI + SQLAlchemy + APScheduler
- **AI**: LangChain + OpenAI Compatible API
- **知识库**: ChromaDB (向量数据库)
- **实时通信**: WebSocket

## 功能特性

- 📡 自动爬取多个 AI 新闻源（MIT Tech Review, TechCrunch, ArXiv 等）
- 🧠 调用 LLM 生成结构化摘要（摘要 / 要点 / 影响分析）
- 📚 ChromaDB 向量知识库，支持语义搜索
- 💬 RAG 问答：基于知识库回答 AI 相关问题
- ⏰ 可配置定时爬取任务
- 📊 WebSocket 实时推送爬取进度
- 📱 响应式设计，支持移动端

## 项目结构

```
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── main.py            # 应用入口 + WebSocket 端点
│   │   ├── config.py          # 配置管理
│   │   ├── database.py        # 数据库连接
│   │   ├── websocket_manager.py  # WebSocket 连接管理
│   │   ├── crawler/           # 爬虫模块
│   │   ├── llm/               # LangChain 摘要
│   │   ├── knowledge/         # ChromaDB 知识库
│   │   ├── scheduler/         # 定时任务
│   │   ├── models/            # 数据模型
│   │   └── routers/           # API 路由
│   ├── venv/                  # Python 虚拟环境
│   ├── .env                   # 环境变量配置
│   └── requirements.txt
├── frontend/                   # Next.js 前端
│   ├── src/
│   │   ├── app/               # 页面
│   │   ├── components/        # 组件
│   │   └── lib/api.ts         # API 封装
│   ├── node_modules/
│   └── package.json
└── README.md
```

## 快速开始

### 1. 环境要求

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Python | 3.10+ | 后端运行环境 |
| Node.js | 18.17+ | 前端运行环境 |
| pip | 24.0+ | 建议升级到最新版 |

### 2. 后端启动

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 升级 pip（推荐）
python -m pip install --upgrade pip

# 安装依赖
pip install -r requirements.txt

# ⚠️ 如果 chromadb 安装失败（需要 C++ 编译器），使用以下命令：
pip install --only-binary :all: chromadb

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 API Key 和模型信息

# 启动服务（推荐使用 python -m 方式，避免 PATH 问题）
python -m uvicorn app.main:app --reload --port 8000
```

后端启动后：
- API 服务: http://localhost:8000
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 3. 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端访问: **http://localhost:3000**

### 4. 环境变量配置

编辑 `backend/.env`：

```env
# 数据库（默认即可，无需修改）
DATABASE_URL=sqlite+aiosqlite:///./news.db

# 向量数据库存储路径（默认即可）
CHROMADB_PATH=./chroma_data

# LLM 配置（OpenAI 兼容接口）
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key-here        # 填入你的 API Key
OPENAI_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1  # API 地址
LLM_MODEL=mimo-v2.5-pro                 # 模型名称

# 定时间隔（分钟）
CRAWL_INTERVAL_MINUTES=60
```

支持的 LLM 提供商：
| 提供商 | LLM_PROVIDER | 说明 |
|--------|--------------|------|
| OpenAI | `openai` | 官方 OpenAI API |
| 小米 MiLM | `openai` | OpenAI 兼容接口，修改 `OPENAI_BASE_URL` |
| 通义千问 | `dashscope` | 阿里云 DashScope |
| Ollama | `ollama` | 本地部署模型 |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/articles` | 分页获取新闻列表 |
| GET | `/api/articles/{id}` | 新闻详情 |
| POST | `/api/articles/crawl` | 手动触发爬取 |
| GET | `/api/articles/stats` | 统计信息 |
| GET | `/api/knowledge/search?q=` | 语义搜索知识库 |
| POST | `/api/knowledge/query` | RAG 问答 |
| GET | `/api/knowledge/stats` | 知识库统计 |
| GET | `/api/scheduler/jobs` | 定时任务列表 |
| POST | `/api/scheduler/jobs` | 创建定时任务 |
| DELETE | `/api/scheduler/jobs/{id}` | 删除任务 |
| WS | `/ws/crawl-progress` | 爬取进度实时推送 |

## 新闻源

| 来源 | 类型 |
|------|------|
| MIT Technology Review | AI 综合 |
| The Verge AI | AI 综合 |
| TechCrunch AI | AI 行业 |
| ArXiv CS.AI | 学术论文 |
| Hugging Face Blog | 技术博客 |

## 常见问题

### chromadb 安装报错：需要 Microsoft Visual C++ 14.0

```
error: Microsoft Visual C++ 14.0 or greater is required
```

**解决方法**：使用预编译的二进制包安装：
```bash
pip install --only-binary :all: chromadb
```

### 后端启动报错：greenlet DLL load failed

```
ValueError: the greenlet library is required to use this function. DLL load failed while importing _greenlet
```

**解决方法**：降级 greenlet 到兼容版本：
```bash
pip install greenlet==3.1.1 --force-reinstall
```

> 这是因为 `greenlet >= 3.2` 在部分 Windows 系统上依赖 `msvcp140.dll`，如果系统缺少该 DLL 就会加载失败。

### 前端 `npm` 或 `node` 命令找不到

```
'node' 不是内部或外部命令，也不是可运行的程序
```

**解决方法**：
1. 确认 Node.js 已安装（终端运行 `node --version` 检查）
2. 如果已安装但仍报错，说明 Node.js 未加入系统 PATH：
   - Windows：将 Node.js 安装目录（如 `D:\node.js`）添加到系统环境变量 `PATH` 中
   - 添加后需**重新打开终端**使配置生效
3. 临时方案：使用完整路径运行，如 `"D:\node.js\npm.cmd" run dev`

### LLM 摘要生成失败

**排查步骤**：
1. 检查 `.env` 中的 API Key 是否正确
2. 确认 `OPENAI_BASE_URL` 可访问
3. 确认 `LLM_MODEL` 是该平台支持的模型名称
4. 查看后端终端日志获取详细错误信息

### 爬取没有结果

部分新闻源（如 ArXiv RSS）可能因网络原因暂时不可用，这是正常现象。其他源会继续正常爬取。
