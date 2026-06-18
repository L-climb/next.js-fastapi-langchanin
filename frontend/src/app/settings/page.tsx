"use client";

import { useState, useEffect, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { getLLMConfig, updateLLMConfig, type LLMConfig } from '@/lib/api';

const LLM_PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'dashscope', name: '通义千问 (DashScope)' },
  { id: 'ollama', name: 'Ollama' },
];

export default function SettingsPage() {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  if (isLoading) {
    return <div>加载中...</div>;
  }

  if (error && !config) {
    return <div className="text-red-500">错误: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-gray-500" />
        <h1 className="text-2xl font-bold text-gray-900">模型配置</h1>
      </div>

      {successMessage && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
         <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form 
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6"
      >
        {/* Provider Select */}
        <div>
          <label htmlFor="provider" className="block text-sm font-medium text-gray-700">
            模型提供商
          </label>
          <select
            id="provider"
            value={config?.provider || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
          <label htmlFor="api_key" className="block text-sm font-medium text-gray-700">
            API Key
          </label>
          <input
            type="password"
            id="api_key"
            value={config?.api_key || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder={config?.provider === 'ollama' ? 'Ollama 无需 API Key' : '请输入你的 API Key'}
            disabled={config?.provider === 'ollama'}
          />
        </div>

        {/* Base URL */}
        <div>
          <label htmlFor="base_url" className="block text-sm font-medium text-gray-700">
            API Base URL
          </label>
          <input
            type="text"
            id="base_url"
            value={config?.base_url || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="例如: https://api.openai.com/v1"
          />
           {config?.provider === 'ollama' && <p className="mt-2 text-xs text-gray-500">Ollama 用户请填写 Ollama 服务的地址, 例如: http://localhost:11434/v1</p>}
        </div>

        {/* Chat Model */}
        <div>
          <label htmlFor="chat_model" className="block text-sm font-medium text-gray-700">
            聊天/摘要模型
          </label>
          <input
            type="text"
            id="chat_model"
            value={config?.chat_model || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="例如: gpt-4o-mini"
          />
        </div>

        {/* Embedding Model */}
        <div>
          <label htmlFor="embedding_model" className="block text-sm font-medium text-gray-700">
            Embedding 模型
          </label>
          <input
            type="text"
            id="embedding_model"
            value={config?.embedding_model || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="例如: text-embedding-3-small (留空则使用默认)"
          />
        </div>

        <div className="flex justify-end">
            <button 
                type="submit"
                disabled={isSaving || isLoading}
                className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
                {isSaving ? '保存中...' : '保存配置'}
            </button>
        </div>
      </form>
    </div>
  );
}
