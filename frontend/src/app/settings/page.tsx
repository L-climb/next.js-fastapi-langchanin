"use client";

import { useState, useEffect, useCallback } from 'react';
import { Settings, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { getLLMConfig, updateLLMConfig, testLLMConfig, type LLMConfig, type TestLLMResponse } from '@/lib/api';

const LLM_PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'dashscope', name: '通义千问 (DashScope)' },
  { id: 'siliconflow', name: '硅基流动 (SiliconFlow)' },
  { id: 'ollama', name: 'Ollama' },
];

export default function SettingsPage() {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestLLMResponse | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLLMConfig();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载配置失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await updateLLMConfig(config);
      setSuccessMessage('配置已成功保存！');
      setTimeout(() => setSuccessMessage(null), 3000); // 3秒后自动消失
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存配置失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!config) return;
    const { id, value } = e.target;
    setConfig({ ...config, [id]: value });
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testLLMConfig();
      setTestResult(result);
    } catch (err) {
      // 网络层或请求本身的错误，显示在测试结果面板中
      const msg = err instanceof Error ? err.message : '测试连通性失败';
      setTestResult({
        chat: { success: false, message: msg },
        embedding: { success: false, message: msg },
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div>加载中...</div>;
  }

  if (error && !config) {
    return <div className="text-pink-600">错误: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-[#9a8a82]" />
        <h1 className="text-2xl font-bold text-[#5a4a42]">模型配置</h1>
      </div>

      {successMessage && (
        <div className="clay-badge bg-green-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium text-green-600">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
         <div className="clay-inset bg-pink-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium text-pink-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form 
        onSubmit={handleSubmit}
        className="clay-card p-6 space-y-6"
      >
        {/* Provider Select */}
        <div>
          <label htmlFor="provider" className="block text-sm font-medium text-[#6a5a52]">
            模型提供商
          </label>
          <select
            id="provider"
            value={config?.provider || ''}
            onChange={handleInputChange}
            className="clay-input mt-1 block w-full px-3 py-2 sm:text-sm"
          >
            {LLM_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* API Key */}
        <div>
          <label htmlFor="api_key" className="block text-sm font-medium text-[#6a5a52]">
            API Key
          </label>
          <input
            type="password"
            id="api_key"
            value={config?.api_key || ''}
            onChange={handleInputChange}
            className="clay-input mt-1 block w-full px-3 py-2 sm:text-sm"
            placeholder={config?.provider === 'ollama' ? 'Ollama 无需 API Key' : '请输入你的 API Key'}
            disabled={config?.provider === 'ollama'}
          />
        </div>

        {/* Base URL */}
        <div>
          <label htmlFor="base_url" className="block text-sm font-medium text-[#6a5a52]">
            API Base URL
          </label>
          <input
            type="text"
            id="base_url"
            value={config?.base_url || ''}
            onChange={handleInputChange}
            className="clay-input mt-1 block w-full px-3 py-2 sm:text-sm"
            placeholder={config?.provider === 'siliconflow' ? 'https://api.siliconflow.cn/v1' : '例如: https://api.openai.com/v1'}
          />
           {config?.provider === 'ollama' && <p className="mt-2 text-xs text-[#9a8a82]">Ollama 用户请填写 Ollama 服务的地址, 例如: http://localhost:11434/v1</p>}
           {config?.provider === 'siliconflow' && <p className="mt-2 text-xs text-[#9a8a82]">硅基流动默认地址: https://api.siliconflow.cn/v1</p>}
        </div>

        {/* Chat Model */}
        <div>
          <label htmlFor="chat_model" className="block text-sm font-medium text-[#6a5a52]">
            聊天/摘要模型
          </label>
          <input
            type="text"
            id="chat_model"
            value={config?.chat_model || ''}
            onChange={handleInputChange}
            className="clay-input mt-1 block w-full px-3 py-2 sm:text-sm"
            placeholder={config?.provider === 'siliconflow' ? '例如: deepseek-ai/DeepSeek-V3' : '例如: gpt-4o-mini'}
          />
          {config?.provider === 'siliconflow' && <p className="mt-2 text-xs text-[#9a8a82]">推荐: deepseek-ai/DeepSeek-V3、Qwen/Qwen2.5-7B-Instruct 等</p>}
        </div>

        {/* Embedding Model */}
        <div>
          <label htmlFor="embedding_model" className="block text-sm font-medium text-[#6a5a52]">
            Embedding 模型
          </label>
          <input
            type="text"
            id="embedding_model"
            value={config?.embedding_model || ''}
            onChange={handleInputChange}
            className="clay-input mt-1 block w-full px-3 py-2 sm:text-sm"
            placeholder={config?.provider === 'siliconflow' ? '例如: BAAI/bge-m3' : '例如: text-embedding-3-small (留空则使用默认)'}
          />
          {config?.provider === 'siliconflow' && <p className="mt-2 text-xs text-[#9a8a82]">推荐: BAAI/bge-m3、BAAI/bge-large-zh-v1.5</p>}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || isSaving}
            className="clay-btn inline-flex items-center gap-2 bg-amber-400 py-2 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isTesting ? '测试中...' : '测试连通性'}
          </button>

          <button
            type="submit"
            disabled={isSaving || isTesting}
            className="clay-btn inline-flex justify-center bg-purple-400 py-2 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSaving ? '保存中...' : '保存配置'}
          </button>
        </div>

        {/* 测试结果展示 */}
        {testResult && (
          <div className="clay-inset p-4 space-y-3">
            <p className="text-sm font-medium text-[#6a5a52]">测试结果</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                {testResult.chat.success ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pink-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-[#6a5a52]">聊天模型</p>
                  <p className={`text-sm ${testResult.chat.success ? 'text-green-600' : 'text-pink-600'}`}>
                    {testResult.chat.message}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                {testResult.embedding.success ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pink-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-[#6a5a52]">Embedding 模型</p>
                  <p className={`text-sm ${testResult.embedding.success ? 'text-green-600' : 'text-pink-600'}`}>
                    {testResult.embedding.message}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
