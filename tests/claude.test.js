import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strictTool, extractToolInput, callTool } from '../scripts/lib/claude.js';

const tool = { name: 'make', description: 'd', input_schema: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } } } };

test('strictTool adds additionalProperties:false, required and strict', () => {
  const s = strictTool(tool);
  assert.equal(s.strict, true);
  assert.equal(s.input_schema.additionalProperties, false);
  assert.deepEqual(s.input_schema.required, ['a', 'b']);
  assert.equal(tool.input_schema.required, undefined, 'original untouched');
});

test('extractToolInput throws on refusal and max_tokens, returns null without tool_use', () => {
  assert.throws(() => extractToolInput({ stop_reason: 'refusal', stop_details: { category: 'cyber', explanation: 'x' }, content: [] }), /refused.*cyber/);
  assert.throws(() => extractToolInput({ stop_reason: 'max_tokens', content: [] }, 'make'), /max_tokens/);
  assert.equal(extractToolInput({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi' }] }, 'make'), null);
});

function fakeClient(responses) {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async params => { calls.push(params); const r = responses.shift(); if (r instanceof Error) throw r; return r; } } }
  };
}
const toolResponse = input => ({ stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: '' }, { type: 'tool_use', name: 'make', input }] });

test('callTool uses auto tool_choice, strict tool, fallbacks and returns the input', async () => {
  const client = fakeClient([toolResponse({ a: '1', b: '2' })]);
  const out = await callTool({ tool, prompt: 'p', client, model: 'claude-opus-5-5' });
  assert.deepEqual(out, { a: '1', b: '2' });
  const p = client.calls[0];
  assert.equal(p.tool_choice.type, 'auto');
  assert.equal(p.tools[0].strict, true);
  assert.equal(p.fallbacks, 'default');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(p.output_config.effort, 'high');
  assert.equal(p.messages[0].content, 'p');
});

test('callTool retries once with explicit instruction when no tool call was made', async () => {
  const client = fakeClient([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Sure!' }] }, toolResponse({ a: '1', b: '2' })]);
  const out = await callTool({ tool, prompt: 'p', client, waitMs: 1 });
  assert.equal(out.a, '1');
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[1].messages[0].content, /Respond ONLY by calling the make tool/);
});

test('callTool retries transient network errors and rethrows other errors immediately', async () => {
  const client = fakeClient([Object.assign(new Error('Premature close'), {}), toolResponse({ a: 'x', b: 'y' })]);
  const out = await callTool({ tool, prompt: 'p', client, waitMs: 1 });
  assert.equal(out.b, 'y');
  const bad = fakeClient([new Error('400 invalid_request_error')]);
  await assert.rejects(callTool({ tool, prompt: 'p', client: bad, waitMs: 1 }), /invalid_request_error/);
  assert.equal(bad.calls.length, 1);
});

test('callTool rejects incomplete tool input', async () => {
  const client = fakeClient([toolResponse({ a: '1' }), toolResponse({ a: '1' }), toolResponse({ a: '1' })]);
  await assert.rejects(callTool({ tool, prompt: 'p', client, waitMs: 1 }), /missing fields: b/);
});
