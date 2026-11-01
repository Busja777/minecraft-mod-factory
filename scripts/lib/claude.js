import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

// Shared Claude access for generate.js / improve.js / fix.js.
// - Model is configurable (config.json "model" or CLAUDE_MODEL); default Claude Opus 5.5.
// - Opus 5.5 rejects forced tool_choice, so we use tool_choice "auto" + strict schemas and
//   instruct the model in the prompt to call the tool; a missing tool call is retried once.
// - Server-side refusal fallback is enabled so a safety-classifier decline re-runs on a fallback model.
// - Transient network errors (L11) are retried.

function readConfigModel() {
  try { return JSON.parse(fs.readFileSync('./config.json', 'utf-8')).model; } catch { return undefined; }
}
export const MODEL = process.env.CLAUDE_MODEL || readConfigModel() || 'claude-opus-5-5';

let defaultClient;
function getClient() {
  if (!defaultClient) defaultClient = new Anthropic({ maxRetries: 5 });
  return defaultClient;
}

const TRANSIENT = /Premature close|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i;

// Makes the tool schema strict-compatible: additionalProperties:false and every property required.
export function strictTool(tool) {
  const schema = { ...tool.input_schema, additionalProperties: false };
  if (!schema.required) schema.required = Object.keys(schema.properties || {});
  return { ...tool, input_schema: schema, strict: true };
}

export function extractToolInput(response, toolName) {
  if (response.stop_reason === 'refusal') {
    const d = response.stop_details || {};
    throw new Error(`Claude refused the request (${d.category || 'unknown'}): ${d.explanation || 'no explanation'}`);
  }
  if (response.stop_reason === 'max_tokens') throw new Error('Claude hit max_tokens before finishing the tool call');
  const block = response.content.find(b => b.type === 'tool_use' && b.name === toolName);
  return block ? block.input : null;
}

// images: [{ data: base64, mediaType: 'image/png' }] are sent before the text prompt.
export function userContent(text, images = []) {
  if (!images.length) return text;
  return [
    ...images.map(i => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType || 'image/png', data: i.data } })),
    { type: 'text', text }
  ];
}

export async function callTool({ tool, prompt, images = [], maxTokens = 16000, effort = 'high', attempts = 3, waitMs = 10000, client = getClient(), model = MODEL }) {
  const strict = strictTool(tool);
  const instruction = `\n\nRespond ONLY by calling the ${strict.name} tool with every field filled in.`;
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      console.log(`Claude API call (${strict.name}, ${model}) — attempt ${attempt}...`);
      const response = await client.beta.messages.create({
        model,
        max_tokens: maxTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort },
        tools: [strict],
        tool_choice: { type: 'auto', disable_parallel_tool_use: true },
        messages: [{ role: 'user', content: userContent(prompt + (attempt > 1 ? instruction : ''), images) }]
      });
      const input = extractToolInput(response, strict.name);
      if (input) {
        const missing = (strict.input_schema.required || []).filter(k => input[k] === undefined);
        if (missing.length) throw new Error(`Tool input missing fields: ${missing.join(', ')}`);
        return input;
      }
      console.log(`Claude answered without calling ${strict.name} — retrying with explicit instruction`);
      lastErr = new Error(`Claude did not call ${strict.name}`);
    } catch (err) {
      lastErr = err;
      const transient = TRANSIENT.test(err.message || '') || err.code === 'ECONNRESET' || err instanceof Anthropic.APIConnectionError;
      if (!transient && !/did not call|missing fields/.test(err.message || '')) throw err;
      if (attempt < attempts && transient) {
        console.log(`Network error (${err.message}) — retrying in ${waitMs / 1000}s...`);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }
  throw lastErr;
}
