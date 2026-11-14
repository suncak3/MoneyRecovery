import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/**
 * The only file that talks to an LLM provider. Pay math never passes through here:
 * the model reads stub photos and rewords messages, and both results are validated
 * before the app uses them. Swap the provider by reimplementing these two functions.
 */

const DEFAULT_MODEL = "claude-opus-5-5";

export class LlmUnavailableError extends Error {
  constructor(message = "AI features aren't configured on this server.") {
    super(message);
  }
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new LlmUnavailableError();
  client ??= new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 });
  return client;
}

const model = () => process.env.LLM_MODEL || DEFAULT_MODEL;

export type LlmImage = { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string };

/** Asks for JSON matching `schema`. Returns null when the model declines or the output doesn't parse. */
export async function completeJson<T extends z.ZodType>(options: {
  system: string;
  prompt: string;
  image?: LlmImage;
  schema: T;
}): Promise<z.infer<T> | null> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (options.image) {
    content.push({ type: "image", source: { type: "base64", media_type: options.image.mediaType, data: options.image.base64 } });
  }
  content.push({ type: "text", text: options.prompt });

  const response = await getClient().beta.messages.parse({
    model: model(),
    max_tokens: 4000,
    system: options.system,
    messages: [{ role: "user", content }],
    output_config: { effort: "medium", format: betaZodOutputFormat(options.schema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (response.stop_reason !== "end_turn") return null;
  return response.parsed_output ?? null;
}

/** Plain text completion for short rewrites. */
export async function completeText(options: { system: string; prompt: string }): Promise<string | null> {
  const response = await getClient().beta.messages.create({
    model: model(),
    max_tokens: 4000,
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  if (response.stop_reason !== "end_turn") return null;
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  return text || null;
}
