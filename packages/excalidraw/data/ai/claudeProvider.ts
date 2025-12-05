import { EDITOR_LS_KEYS } from "@excalidraw/common";

import { EditorLocalStorage } from "../EditorLocalStorage";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{
    type: "text";
    text: string;
  }>;
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence";
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeError {
  type: "error";
  error: {
    type: string;
    message: string;
  };
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 4096;

export const getClaudeApiKey = (): string | null => {
  return EditorLocalStorage.get<string>(EDITOR_LS_KEYS.CLAUDE_API_KEY);
};

export const setClaudeApiKey = (apiKey: string): void => {
  EditorLocalStorage.set(EDITOR_LS_KEYS.CLAUDE_API_KEY, apiKey);
};

export const getAIProvider = (): "claude" | "openai" | "backend" => {
  const provider = EditorLocalStorage.get<string>(EDITOR_LS_KEYS.AI_PROVIDER);
  if (provider === "claude" || provider === "openai") {
    return provider;
  }
  return "backend";
};

export const setAIProvider = (
  provider: "claude" | "openai" | "backend",
): void => {
  EditorLocalStorage.set(EDITOR_LS_KEYS.AI_PROVIDER, provider);
};

export const generateWithClaude = async (
  prompt: string,
  systemPrompt: string,
  options?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  },
): Promise<ClaudeResponse | ClaudeError> => {
  const apiKey = options?.apiKey || getClaudeApiKey();

  if (!apiKey) {
    return {
      type: "error",
      error: {
        type: "authentication_error",
        message:
          "Claude API key not configured. Please set your API key in AI Settings.",
      },
    };
  }

  const model = options?.model || DEFAULT_MODEL;
  const maxTokens = options?.maxTokens || DEFAULT_MAX_TOKENS;
  const temperature = options?.temperature ?? 0.3;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        type: "error",
        error: {
          type: data.error?.type || "api_error",
          message:
            data.error?.message ||
            `API request failed with status ${response.status}`,
        },
      };
    }

    return data as ClaudeResponse;
  } catch (error) {
    return {
      type: "error",
      error: {
        type: "network_error",
        message:
          error instanceof Error ? error.message : "Network request failed",
      },
    };
  }
};

export const testClaudeConnection = async (
  apiKey: string,
): Promise<boolean> => {
  const result = await generateWithClaude(
    "Say 'ok' if you can read this.",
    "You are a test assistant. Respond only with 'ok'.",
    { apiKey, maxTokens: 10 },
  );

  if ("error" in result && result.type === "error") {
    return false;
  }

  return true;
};
