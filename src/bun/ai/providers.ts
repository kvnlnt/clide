import type { AIService } from "../../shared/types";
import { DEFAULT_MODEL_FOR_KIND } from "../../shared/types";
import { getCredential } from "./credentials";

export interface CompletionRequest {
  system: string;
  user: string;
}

/**
 * Provider abstraction, dispatching on a configured AIService rather than a
 * fixed provider union — covers any number of user-added services, local or
 * remote. The caller is responsible for parsing JSON out of the raw response.
 */
export async function complete(service: AIService, req: CompletionRequest): Promise<string> {
  const model = service.model?.trim() || DEFAULT_MODEL_FOR_KIND[service.kind];
  switch (service.kind) {
    case "anthropic":
      return completeAnthropic(service, req, model);
    case "openai":
      return completeOpenAI(service, req, model);
    case "openai-compatible":
      return completeOpenAICompatible(service, req, model);
    case "ollama":
      return completeOllama(service, req, model);
    default:
      throw new Error(`Unknown AI service kind: ${service.kind}`);
  }
}

async function completeAnthropic(service: AIService, req: CompletionRequest, model: string): Promise<string> {
  const key = await getCredential(service.id);
  if (!key) throw new Error(`Missing API key for "${service.name}"`);
  const res = await fetch(service.baseUrl?.trim() || "https://api.anthropic.com/v1/messages", {
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
    throw new Error(`${service.name} error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  return (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
}

async function completeOpenAI(service: AIService, req: CompletionRequest, model: string): Promise<string> {
  const key = await getCredential(service.id);
  if (!key) throw new Error(`Missing API key for "${service.name}"`);
  const res = await fetch(service.baseUrl?.trim() || "https://api.openai.com/v1/chat/completions", {
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
    throw new Error(`${service.name} error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Covers local/remote OpenAI-compatible servers (LM Studio, vLLM, OpenRouter, etc). API key is optional. */
async function completeOpenAICompatible(service: AIService, req: CompletionRequest, model: string): Promise<string> {
  const baseUrl = service.baseUrl?.trim();
  if (!baseUrl) throw new Error(`"${service.name}" is missing a base URL`);
  const key = await getCredential(service.id);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers,
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
    throw new Error(`${service.name} error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

async function completeOllama(service: AIService, req: CompletionRequest, model: string): Promise<string> {
  const baseUrl = service.baseUrl?.trim() || "http://localhost:11434";
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/generate`, {
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
    throw new Error(`${service.name} error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { response?: string };
  return json.response ?? "";
}
