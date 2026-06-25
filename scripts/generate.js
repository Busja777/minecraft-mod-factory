import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

let recentMods = [];
try { recentMods = JSON.parse(fs.readFileSync('./data/recent-mods.json', 'utf-8')); } catch {}

const avoidList = recentMods.map(m => m.name).join(', ') || 'none';

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  tools: [{
    name: 'create_mod',
    description: 'Create a Minecraft Fabric QoL mod',
    input_schema: {
      type: 'object',
      properties: {
        name:        { type: 'string', description: 'Mod display name, e.g. "AutoSort"' },
        modId:       { type: 'string', description: 'Mod ID: lowercase letters and hyphens only, e.g. "auto-sort"' },
        description: { type: 'string', description: '1-2 sentence description for CurseForge' },
        changelog:   { type: 'string', description: 'Markdown changelog for v1.0.0' },
        javaCode:    { type: 'string', description: 'Complete, compilable Java source for ModMain.java using package com.factory.mod and class ModMain implementing ModInitializer' },
        imagePrompt: { type: 'string', description: 'Detailed fal.ai image prompt for a gaming thumbnail' }
      },
      required: ['name', 'modId', 'description', 'changelog', 'javaCode', 'imagePrompt']
    }
  }],
  tool_choice: { type: 'tool', name: 'create_mod' },
  messages: [{
    role: 'user',
    content: `You are an expert Minecraft Fabric 1.21.1 mod developer.
Generate a small, useful ${config.niche} mod (${config.style}).
Rules:
- Package must be: com.factory.mod
- Main class must be: ModMain implementing net.fabricmc.api.ModInitializer
- Must compile with Fabric API 0.102.0+1.21.1 and Java 21
- Keep it simple: one clear feature, 50-200 lines max
- Use only vanilla Minecraft + Fabric API imports
- No external dependencies
Avoid these already-made mods: ${avoidList}`
  }]
});

const toolUse = response.content.find(b => b.type === 'tool_use');
if (!toolUse) throw new Error('Claude did not return tool_use block');

const mod = toolUse.input;
mod.modId = mod.modId.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32);

recentMods.unshift({ name: mod.name, modId: mod.modId });
if (recentMods.length > 10) recentMods.length = 10;
fs.writeFileSync('./data/recent-mods.json', JSON.stringify(recentMods, null, 2));
fs.writeFileSync('./generated-mod.json', JSON.stringify(mod, null, 2));
console.log(`Generated: ${mod.name} (${mod.modId})`);
