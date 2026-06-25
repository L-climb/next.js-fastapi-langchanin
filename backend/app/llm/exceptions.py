"""
LLM 服务异常处理
统一识别配置缺失、鉴权失败、连接失败等错误，返回友好提示
"""

LLM_CONFIG_MESSAGE = "请配置大模型密钥，包括 Embedding 模型"

class LLMServiceError(Exception):
    """大模型 / Embedding 服务不可用"""

    def __init__(
        self,
        message: str | None = None,
        *,
        model_type: str = "chat",
        error_code: str = "LLM_CONFIG_REQUIRED",
    ):
        self.message = message or LLM_CONFIG_MESSAGE
        self.model_type = model_type
        self.error_code = error_code
        super().__init__(self.message)


def validate_llm_config(config, *, for_embedding: bool = False) -> None:
    """调用前校验 LLM 配置是否完整"""
    provider = (config.provider or "openai").lower()
    api_key = (config.api_key or "").strip()

    if provider != "ollama":
        if not api_key or api_key.lower() in {"your-api-key-here", "sk-xxx", "placeholder"}:
            raise LLMServiceError(model_type="config")

        if for_embedding and not (config.embedding_model or "").strip():
            raise LLMServiceError(
                message=LLM_CONFIG_MESSAGE,
                model_type="embedding",
            )


def wrap_llm_error(exc: Exception, *, model_type: str = "chat") -> LLMServiceError:
    """将底层异常转换为用户可理解的 LLM 错误，保留原始错误信息"""
    if isinstance(exc, LLMServiceError):
        return exc

    err_msg = str(exc)
    err_str = err_msg.lower()
    err_type = type(exc).__name__.lower()

    # 截断过长的错误信息
    if len(err_msg) > 300:
        err_msg = err_msg[:300] + "..."

    config_indicators = (
        "401",
        "403",
        "unauthorized",
        "authentication",
        "invalid api key",
        "incorrect api key",
        "api key",
        "invalid_api_key",
        "permission denied",
        "connection error",
        "connect",
        "connection refused",
        "timeout",
        "timed out",
        "getaddrinfo",
        "network",
        "unreachable",
        "ssl",
        "model not found",
        "does not exist",
        "not found",
        "api connection",
        "authenticationerror",
        "apiconnectionerror",
        "rate limit",
        "insufficient_quota",
    )

    if any(ind in err_str or ind in err_type for ind in config_indicators):
        label = "Embedding 模型" if model_type == "embedding" else "大模型"
        return LLMServiceError(
            message=f"{label}调用失败: {err_msg}",
            model_type=model_type,
        )

    label = "Embedding 模型" if model_type == "embedding" else "大模型"
    return LLMServiceError(
        message=f"{label}调用失败: {err_msg}",
        model_type=model_type,
        error_code="LLM_CALL_FAILED",
    )
