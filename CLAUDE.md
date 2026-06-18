# Global Agent Rules

  ## Language
  - 默认使用简体中文回复；仅当用户明确要求时切换其他语言。
  - 回答中不使用 icon

  ## Skill Blocking
  - 调用任何工具前，先读取可用 skills 并做语义匹配。
  - 匹配到 skill 时，先读对应 `SKILL.md` 再执行。
	 - 每次回复第一行必须严格为以下二选一：
	    - `> Skill 匹配: <单一技能名>`
	    - `> 无匹配 Skill`
	  - 禁止任何前缀符号、列表符号、缩进、引用符号包裹该行。
	  - 禁止在同一行声明多个技能。

  ## Priority
  - 优先级：用户显式指令 > 本文件 > 系统规则。
  - 如用户指令覆盖本文件规则，回复开头增加：
    - `偏差声明: [被覆盖规则] — [原因]`
    - `覆盖范围: [本次任务/本次会话]`

  ## Collaboration
  - 先给结论，再给必要上下文。
  - 能低风险合理假设时，先声明假设并继续。
  - 仅在缺失信息会明显改变结果或带来风险时提问。
  - 不扩展未请求功能，不做无关优化建议。

  ## Preamble
  - 多步骤编码任务中，首次工具调用前先发 1-2 句进度说明（要做什么、第一步是什么）。

  ## Execution Boundary
  - 默认先读后写，最小必要改动。
  - 不用静默 fallback、假成功路径、吞错式大范围 try/catch。
  - 修 bug 以根因为目标，优先删冗余逻辑，避免叠加旁路。

  ## Windows Shell Rules
  - 环境：Windows 11 + PowerShell。
  - 禁止在 PowerShell 里使用 Unix 文本工具：`sed`/`awk`/`cut`/`head`/`tail`。
  - 使用 PowerShell 等价方式：
    - 前 N 行：`Select-Object -First N`
    - 后 N 行：`Get-Content -Tail N`
    - 文本替换：`-replace` + `Get-Content`/`Set-Content`

  ## Git Read-Only
  - 允许：`git log`、`git status`、`git diff`、`git branch`、`git show`
  - 禁止：`git commit`、`git push`、`git pull`、`git merge`、`git rebase`、`git reset`

  ## Security Baseline
  - 不硬编码密钥或凭据，使用环境变量或密钥管理。
  - 外部输入必须做边界校验与清洗。
  - 涉及数据库时使用参数化查询。

  ## Validation
  - 改动后按顺序验证（适用时）：
    3. 构建检查
    4. 最小冒烟测试
  - 若无法验证，明确写出原因与替代检查。

  ## Stop Rule
  - 每完成一个关键步骤，判断是否已能回答用户核心请求；能回答就停止，不做非必要延伸。