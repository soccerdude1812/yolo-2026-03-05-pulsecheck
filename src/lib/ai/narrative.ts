// src/lib/ai/narrative.ts
// AI narrative generation — Gemini 2.0 Flash primary, Groq Llama 3.3 70B fallback.
// Returns the 3-5 sentence plain-English digest + which model produced it.

import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { env } from '@/lib/utils/env';
import { buildSystemPrompt, buildUserPrompt } from './prompts';
import type { NarrativeInput, NarrativeJsonOutput } from './prompts';

// ─────────────────────────────────────────────────────────────────────────────
// RESULT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface NarrativeResult {
  narrative: string;
  model_used: string;
  generated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips markdown code fences from a string.
 * Gemini sometimes wraps JSON in ```json ... ``` blocks.
 */
function stripMarkdownFences(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` blocks
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

/**
 * Parses the AI response and extracts the narrative string.
 * Handles both Gemini (markdown fences possible) and Groq (plain JSON).
 */
function parseNarrativeJson(raw: string, provider: 'gemini' | 'groq'): string {
  let cleaned = raw.trim();

  if (provider === 'gemini') {
    cleaned = stripMarkdownFences(cleaned);
  }

  let parsed: NarrativeJsonOutput;
  try {
    parsed = JSON.parse(cleaned) as NarrativeJsonOutput;
  } catch {
    // Last-ditch: if the whole response looks like prose (not JSON), use it directly
    // This gracefully handles providers that ignore the JSON instruction
    if (cleaned.length > 20 && !cleaned.startsWith('{')) {
      return cleaned;
    }
    throw new Error(`Failed to parse JSON from ${provider} response: ${cleaned.slice(0, 200)}`);
  }

  if (!parsed.narrative || typeof parsed.narrative !== 'string') {
    throw new Error(`${provider} response missing "narrative" field`);
  }

  return parsed.narrative.trim();
}

/**
 * Race a promise against a timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────────────────────

async function generateWithGemini(input: NarrativeInput): Promise<string> {
  const genAI = new GoogleGenerativeAI(env.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
      maxOutputTokens: 512,
    },
    systemInstruction: buildSystemPrompt(),
  });

  const result = await model.generateContent(buildUserPrompt(input));
  const text = result.response.text();

  return parseNarrativeJson(text, 'gemini');
}

async function generateWithGroq(input: NarrativeInput): Promise<string> {
  const groq = new Groq({ apiKey: env.groqApiKey });

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 512,
  });

  const text = completion.choices[0]?.message?.content ?? '';
  return parseNarrativeJson(text, 'groq');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — dual-provider with fallback
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDER_TIMEOUT_MS = 25_000; // 25s per provider, 50s worst case

/**
 * Generates a plain-English health narrative for a repo's weekly data.
 *
 * Strategy:
 * 1. Try Gemini 2.0 Flash with a 25s timeout.
 * 2. If Gemini fails (any error, including timeout/rate-limit), fall back to Groq.
 * 3. If Groq also fails, rethrow the Groq error.
 *
 * Returns the narrative text + which model was used.
 */
export async function generateNarrative(input: NarrativeInput): Promise<NarrativeResult> {
  const now = new Date().toISOString();

  // Attempt 1: Gemini
  try {
    const narrative = await withTimeout(
      generateWithGemini(input),
      PROVIDER_TIMEOUT_MS,
      'Gemini'
    );

    return {
      narrative,
      model_used: 'gemini-2.0-flash',
      generated_at: now,
    };
  } catch (geminiError) {
    // Log the Gemini failure but do NOT surface to caller yet — fall back to Groq
    console.error('[narrative] Gemini failed, falling back to Groq:', geminiError instanceof Error ? geminiError.message : String(geminiError));
  }

  // Attempt 2: Groq Llama 3.3 70B
  const narrative = await withTimeout(
    generateWithGroq(input),
    PROVIDER_TIMEOUT_MS,
    'Groq'
  );

  return {
    narrative,
    model_used: 'llama-3.3-70b-versatile',
    generated_at: now,
  };
}
