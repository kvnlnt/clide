import { getDefaultAIService } from "./aiServices";
import { complete } from "./providers";

const SYSTEM_PROMPT = [
  "You name a saved filter view inside CLIDE, a task automation app.",
  "Given the view's filter criteria and a sample of the runs it currently matches, respond with a short,",
  "recognizable name — 2-4 words, no punctuation at the edges, title case optional. Think tab label, not sentence.",
  'Respond ONLY with a single JSON object: { "name": string }.',
].join("\n");

/**
 * AI-suggested short name for a saved view (ticket 116) — same
 * fire-and-forget, never-throws shape as runSummary.ts's generateRunSummary.
 * Callers always have a deterministic fallback ready; this only upgrades it.
 */
export async function generateViewName(filterSummary: string, sampleRuns: string[]): Promise<string | null> {
  try {
    const service = await getDefaultAIService();
    if (!service) return null; // No AI configured — caller falls back

    const user = [
      `Filters: ${filterSummary}`,
      sampleRuns.length > 0 ? `Sample matching runs:\n${sampleRuns.join("\n")}` : "No runs match yet.",
    ].join("\n\n");

    const raw = await complete(service, { system: SYSTEM_PROMPT, user });
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1]! : raw;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as { name?: unknown };
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    return name ? name.slice(0, 40) : null;
  } catch (err) {
    console.warn("[viewNaming] AI generation failed:", err);
    return null; // Degrade gracefully — deterministic fallback takes over
  }
}
