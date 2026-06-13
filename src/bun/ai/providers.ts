import type { AIProvider } from "../../shared/types";
import { DEFAULT_MODEL } from "../../shared/types";
import { getCredential } from "./credentials";

export interface CompletionRequest {
  system: string;
  user: string;
}

/**
 * Provider abstraction. Each provider takes a system + user prompt and returns
 * the model's raw text response. The caller is responsible for parsing JSON out
 * of that text. An optional `model` overrides the provider's default model.
 */
export async function complete(provider: AIProvider, req: CompletionRequest, model?: string): Promise<string> {
  const resolvedModel = model?.trim() || DEFAULT_MODEL[provider];
  switch (provider) {
    case "claude":
      return completeClaude(req, resolvedModel);
    case "openai":
      return completeOpenAI(req, resolvedModel);
    case "ollama":
      return completeOllama(req, resolvedModel);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function completeClaude(req: CompletionRequest, model: string): Promise<string> {
  const key = await getCredential("claude");
  if (!key) throw new Error("Missing Claude API key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  return (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
}

async function completeOpenAI(req: CompletionRequest, model: string): Promise<string> {
  const key = await getCredential("openai");
  if (!key) throw new Error("Missing OpenAI API key");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

async function completeOllama(req: CompletionRequest, model: string): Promise<string> {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      system: req.system,
      prompt: req.user,
      format: "json",
      stream: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { response?: string };
  return json.response ?? "";
}
