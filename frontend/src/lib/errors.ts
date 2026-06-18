export const LLM_CONFIG_MESSAGE = "请配置大模型密钥，包括 Embedding 模型";

export type ApiError = Error & {
  errorCode?: string;
  isLLMConfigError?: boolean;
};

export async function parseApiError(
  res: Response,
  fallback: string
): Promise<ApiError> {
  try {
    const data = await res.json();
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail[0]?.msg ?? fallback
          : fallback;
    const err = new Error(detail || fallback) as ApiError;
    err.errorCode = data.error_code;
    err.isLLMConfigError =
      data.error_code === "LLM_CONFIG_REQUIRED" ||
      data.error_code === "LLM_CALL_FAILED" ||
      detail?.includes("请配置大模型密钥");
    return err;
  } catch {
    return new Error(fallback) as ApiError;
  }
}

export function isLLMConfigError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const apiErr = err as ApiError;
  return (
    apiErr.isLLMConfigError === true ||
    err.message.includes("请配置大模型密钥")
  );
}
