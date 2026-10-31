import fs from 'fs';
import { callTool } from './lib/claude.js';
import { loadAllMeta } from './lib/mods.js';

// Generates a new Fabric 1.21.1 mod concept + source. Output: ./generated-mod.json
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

const published = fs.existsSync('./data/published-mods.json') ? JSON.parse(fs.readFileSync('./data/published-mods.json', 'utf-8')) : [];
const known = new Map();
for (const m of [...published, ...loadAllMeta()]) if (!known.has(m.modId)) known.set(m.modId, m);

const avoidSection = known.size > 0
  ? `ALREADY EXISTING — do NOT repeat these features or concepts:\n${[...known.values()].map(m =>
      `- ${m.name}: ${m.description} (features: ${(m.features || []).join(', ')})`).join('\n')}`
  : 'No mods exist yet — any idea is fair game.';

export const CF_CATEGORIES = ['Utility & QoL', 'Server Utility', 'Map and Information', 'Food', 'Storage', 'Mobs', 'Miscellaneous'];

const mod = await callTool({
  tool: {
    name: 'create_mod',
    description: 'Create a complete Minecraft Fabric 1.21.1 mod: concept, store listing and compilable source.',
    input_schema: {
      type: 'object',
      properties: {
        name:            { type: 'string', description: 'Mod display name, e.g. "AutoSort". Must be unique and descriptive.' },
        altNames:        { type: 'array', items: { type: 'string' }, description: 'Exactly 2 alternative names in case the first is taken' },
        modId:           { type: 'string', description: 'Lowercase letters and hyphens only, max 32 chars' },
        description:     { type: 'string', description: '1-2 sentence summary for the project list (max 250 chars)' },
        pageDescription: { type: 'string', description: 'Full project page in Markdown: intro paragraph, "## Features" bullet list, "## How it works", "## Compatibility" (Fabric 1.21.1, Fabric API, server-side). 150-300 words, no placeholders.' },
        cfCategory:      { type: 'string', enum: CF_CATEGORIES, description: 'Best fitting CurseForge category' },
        changelog:       { type: 'string', description: 'Markdown changelog for v1.0.0 listing every feature' },
        javaCode:        { type: 'string', description: 'Complete, compilable Java source for ModMain.java' },
        imagePrompt:     { type: 'string', description: 'Detailed image prompt for a 400x400 mod icon (no text in the image)' },
        features:        { type: 'array', items: { type: 'string' }, description: '3-6 keywords describing what this mod does' }
      },
      required: ['name', 'altNames', 'modId', 'description', 'pageDescription', 'cfCategory', 'changelog', 'javaCode', 'imagePrompt', 'features'],
      additionalProperties: false
    }
  },
  prompt: `You are an expert Minecraft Fabric 1.21.1 mod developer and creative director.

Your task: design and implement a small but genuinely useful ${config.niche} mod (${config.style}). Call the create_mod tool with the result.

CREATIVITY RULES:
- Think of 3 different mod concepts internally, then pick the most unique and useful one
- The mod must solve a real player or server-admin pain point that is NOT already solved by well-known mods
- Avoid generic ideas — look for the gap in the market
- The name should be memorable and clearly describe what it does

QUALITY BAR (CurseForge rejects low-effort projects):
- 2-3 related features that form one coherent mod, not a single trivial tweak
- 150-300 lines of clean, commented Java; sensible constants grouped at the top
- Player-facing messages must be polished (no debug text)
- pageDescription must read like a real store page a human wrote

STRICT COMPILE RULES — must compile with Fabric API 0.102.0+1.21.1 and Java 21:
- Package: com.factory.mod | Class: ModMain implements net.fabricmc.api.ModInitializer
- No external dependencies besides Fabric API
- Server-side only (no client classes in main entrypoint)

SAFE APIs (confirmed exist in 1.21.1):
- ServerTickEvents.END_SERVER_TICK, ServerTickEvents.END_WORLD_TICK
- UseEntityCallback, AttackEntityCallback, PlayerBlockBreakEvents, UseBlockCallback, UseItemCallback
- ServerPlayerEntity: sendMessage(Text, boolean actionBar), getInventory(), getHealth(), getHungerManager(), getExperienceLevel(), getUuid(), getName()
- ItemStack, Items, Inventories, NbtCompound, Formatting
- Text.literal(), Text.translatable()
- ServerWorld, World: getPlayers(), getTime(), getTimeOfDay(), isRaining(), isThundering(), getRegistryKey()
- ServerLifecycleEvents.SERVER_STARTED/SERVER_STOPPING, ServerPlayConnectionEvents.JOIN/DISCONNECT
- CommandRegistrationCallback.EVENT with com.mojang.brigadier (CommandManager.literal/argument) for simple /commands
- MinecraftServer.getPlayerManager().getPlayerList(), getPlayerManager().broadcast(Text, boolean)

BANNED (will cause compile errors):
- setStepHeight() / getStepHeight() — use getAttribute(EntityAttributes.GENERIC_STEP_HEIGHT)
- Any net.minecraft.client.* class in server entrypoint
- Mixins, ASM, access wideners, or reflection
- Scoreboard/Team APIs unless you are certain of the 1.21.1 signatures

PREFERRED PATTERN:
\`\`\`java
package com.factory.mod;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

public class ModMain implements ModInitializer {
    @Override
    public void onInitialize() {
        ServerTickEvents.END_SERVER_TICK.register(server -> {
            for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
                // your logic here
            }
        });
    }
}
\`\`\`

${avoidSection}`
});

mod.modId = mod.modId.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
if (!CF_CATEGORIES.includes(mod.cfCategory)) mod.cfCategory = 'Utility & QoL';
fs.writeFileSync('./generated-mod.json', JSON.stringify(mod, null, 2));
console.log(`Generated: ${mod.name} (${mod.modId}) — ${mod.javaCode.split('\n').length} lines`);
console.log(`Features: ${(mod.features || []).join(', ')}`);
