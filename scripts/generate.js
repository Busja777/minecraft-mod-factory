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

STRICT RULES — the code must compile with Fabric API 0.102.0+1.21.1 and Java 21:
- Package: com.factory.mod | Main class: ModMain implements net.fabricmc.api.ModInitializer
- Keep it simple: one clear feature, 50-150 lines max, no external dependencies
- Use only vanilla Minecraft + Fabric API imports

SAFE APIs to use (these exist in 1.21.1):
- ServerTickEvents.END_SERVER_TICK, ServerTickEvents.END_WORLD_TICK
- UseEntityCallback, AttackEntityCallback, PlayerBlockBreakEvents
- ServerPlayerEntity methods: sendMessage(), getInventory(), getHealth(), getHungerManager()
- ItemStack, Items, Inventories
- Text.literal(), Text.translatable()
- ServerWorld, World methods: getPlayers(), getTime()
- ServerLifecycleEvents.SERVER_STARTED

BANNED — do NOT use (removed or changed in 1.21.1):
- setStepHeight(), getStepHeight() — removed, use getAttribute(EntityAttributes.GENERIC_STEP_HEIGHT)
- Any method not in the standard Fabric API 0.102.0 javadocs
- Mixins, ASM, reflection
- Client-side only classes (MinecraftClient, etc.) in server entrypoint

PREFERRED PATTERN — simple event-based mods:
\`\`\`java
ServerTickEvents.END_SERVER_TICK.register(server -> {
    for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
        // your logic here
    }
});
\`\`\`

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
