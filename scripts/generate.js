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
    description: 'Create a Minecraft Fabric 1.21.1 QoL mod',
    input_schema: {
      type: 'object',
      properties: {
        name:        { type: 'string', description: 'Mod display name, e.g. "AutoSort"' },
        modId:       { type: 'string', description: 'Lowercase letters and hyphens only, max 32 chars, e.g. "auto-sort"' },
        description: { type: 'string', description: '1-2 sentence description for the mod page' },
        changelog:   { type: 'string', description: 'Markdown changelog for v1.0.0' },
        javaCode:    { type: 'string', description: 'Complete, compilable Java source for ModMain.java' },
        imagePrompt: { type: 'string', description: 'Detailed image generation prompt for a gaming thumbnail' }
      },
      required: ['name', 'modId', 'description', 'changelog', 'javaCode', 'imagePrompt']
    }
  }],
  tool_choice: { type: 'tool', name: 'create_mod' },
  messages: [{
    role: 'user',
    content: `You are an expert Minecraft Fabric 1.21.1 mod developer.
Generate a small, useful ${config.niche} mod (${config.style}).

STRICT RULES — must compile with Fabric API 0.102.0+1.21.1 and Java 21:
- Package: com.factory.mod | Class: ModMain implements net.fabricmc.api.ModInitializer
- Simple: one clear feature, 50-150 lines, no external dependencies
- Server-side only (no client classes in main entrypoint)

SAFE APIs (confirmed exist in 1.21.1):
- ServerTickEvents.END_SERVER_TICK, ServerTickEvents.END_WORLD_TICK
- UseEntityCallback, AttackEntityCallback, PlayerBlockBreakEvents
- ServerPlayerEntity: sendMessage(), getInventory(), getHealth(), getHungerManager(), getExperienceLevel()
- ItemStack, Items, Inventories, NbtCompound
- Text.literal(), Text.translatable()
- ServerWorld, World: getPlayers(), getTime(), isRaining()
- ServerLifecycleEvents.SERVER_STARTED

BANNED (removed/changed in 1.21.1 — will cause compile errors):
- setStepHeight() / getStepHeight() — use getAttribute(EntityAttributes.GENERIC_STEP_HEIGHT)
- MinecraftClient or any net.minecraft.client.* class in server entrypoint
- Mixins, ASM, or reflection

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

Already made — do not repeat: ${avoidList}`
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
