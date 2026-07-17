import type { Category } from "./db";

export interface CategorizationResult {
  category: Category;
  todos: string[];
  ideas: string[];
  coteraRaw: unknown;
}

interface CocoInvokeResponse {
  category?: unknown;
  todos?: unknown;
  ideas?: unknown;
  content?: Array<{ type?: string; text?: string }>;
  output?: unknown;
  result?: unknown;
  response?: unknown;
  structuredOutput?: unknown;
  text?: unknown;
}

const COCO_INVOKE_URL = "https://app.cotera.co/api/v1/resource/coco/invoke";
const COCO_INVOKE_SCHEMA = "coco-invoke-2026-06-01";
const DEFAULT_COTERA_MODEL = "azure-gpt-5.5";

const SYSTEM_SUFFIX =
  "You are a strict JSON API. Return only valid JSON with no greeting, preamble, markdown, or explanation.";

function categorizationPrompt(content: string): string {
  return [
    "Classify this stream-of-consciousness input as either an idea or a todo.",
    "Return only valid JSON with this exact shape:",
    "{\"category\":\"idea\"|\"todo\",\"todos\":string[],\"ideas\":string[]}",
    "Choose exactly one primary category. Extract concise todos or ideas from the text.",
    "Input:",
    content,
  ].join("\n");
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function parseCategorizationObject(parsed: Record<string, unknown>, coteraRaw: unknown, content: string): CategorizationResult {
  const rawCategory = typeof parsed.category === "string" ? parsed.category.toLowerCase() : "";
  if (rawCategory !== "todo" && rawCategory !== "idea") throw new Error("Cotera returned an invalid category.");

  const category: Category = rawCategory;
  const todos = stringArray(parsed.todos);
  const ideas = stringArray(parsed.ideas);

  return {
    category,
    todos: todos.length > 0 || category !== "todo" ? todos : [content.trim()],
    ideas: ideas.length > 0 || category !== "idea" ? ideas : [content.trim()],
    coteraRaw,
  };
}

function parseCategorizationText(text: string, coteraRaw: unknown, content: string): CategorizationResult {
  try {
    const parsed: unknown = JSON.parse(stripCodeFence(text));
    if (!isObject(parsed)) throw new Error("Cotera returned invalid JSON.");

    return parseCategorizationObject(parsed, coteraRaw, content);
  } catch (err) {
    if (err instanceof SyntaxError) throw new Error("Cotera returned non-JSON text.");
    throw err;
  }
}

function extractText(data: CocoInvokeResponse): string {
  if (typeof data.text === "string") return data.text.trim();

  return data.content
    ?.filter(block => block.type === "text" && typeof block.text === "string")
    .map(block => block.text)
    .join("\n")
    .trim() ?? "";
}

function parseCategorization(data: CocoInvokeResponse, content: string): CategorizationResult {
  if (data.category) return parseCategorizationObject(data as Record<string, unknown>, data, content);

  for (const value of [data.structuredOutput, data.output, data.result, data.response]) {
    if (isObject(value)) return parseCategorization(value as CocoInvokeResponse, content);
    if (typeof value === "string" && value.trim()) return parseCategorizationText(value, data, content);
  }

  const text = extractText(data);
  if (!text) throw new Error("Cotera returned an empty response.");

  return parseCategorizationText(text, data, content);
}

function errorMessage(prefix: string, status: number, body: unknown): string {
  if (isObject(body)) {
    const message = body.message ?? body.error ?? body.detail;
    if (typeof message === "string" && message.trim()) return `${prefix} with status ${status}: ${message.trim()}`;
  }

  return `${prefix} with status ${status}.`;
}

export async function categorizeMessage(content: string): Promise<CategorizationResult> {
  const apiKey = process.env.COTERA_API_KEY;
  const trimmed = content.trim();

  if (!apiKey) throw new Error("COTERA_API_KEY is required.");

  const response = await fetch(COCO_INVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "x-api-schema": COCO_INVOKE_SCHEMA,
    },
    body: JSON.stringify({
      prompt: categorizationPrompt(trimmed),
      systemSuffix: SYSTEM_SUFFIX,
      model: process.env.COTERA_MODEL ?? DEFAULT_COTERA_MODEL,
      triggerSource: "chat",
    }),
  });

  let coteraRaw: unknown = null;
  try {
    coteraRaw = await response.json();
  } catch {
    coteraRaw = { source: "cotera", status: response.status, parseError: true };
  }

  if (!response.ok) throw new Error(errorMessage("Cotera request failed", response.status, coteraRaw));
  if (!isObject(coteraRaw)) throw new Error("Cotera returned invalid JSON.");

  return parseCategorization(coteraRaw as CocoInvokeResponse, trimmed);
}
