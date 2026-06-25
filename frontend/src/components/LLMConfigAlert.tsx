"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { LLM_CONFIG_MESSAGE } from "@/lib/errors";

interface LLMConfigAlertProps {
  message?: string;
}

export default function LLMConfigAlert({ message }: LLMConfigAlertProps) {
  return (
    <div className="clay-inset px-4 py-3 text-sm text-amber-800">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <p className="font-medium">{message || LLM_CONFIG_MESSAGE}</p>
          <p className="mt-1 text-amber-800/80">
            请在模型配置页填写 API Key、Base URL、聊天模型及 Embedding 模型。
          </p>
          <Link
            href="/settings"
            className="mt-2 inline-block font-medium text-purple-500 hover:text-purple-700"
          >
            前往模型配置 →
          </Link>
        </div>
      </div>
    </div>
  );
}
