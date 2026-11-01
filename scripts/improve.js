import crypto from 'crypto';
import { callTool } from './lib/claude.js';
import { loadMod, saveMod, bumpMinor } from './lib/mods.js';
import { setOutputs, arg } from './lib/github-output.js';

// Update path: asks Claude for ONE real, changelog-worthy improvement to a stored mod,
// verifies the source actually changed, bumps the minor version and stores the result.
const modId = arg(process.argv.slice(2), '--mod');
if (!modId) throw new Error('Usage: node scripts/improve.js --mod <modId>');

const { meta, javaCode } = loadMod(modId);
const nextVersion = bumpMinor(meta.version);
const history = (meta.changelog || []).map(c => `### ${c.version} (${c.date})\n${c.text}`).join('\n\n');

const result = await callTool({
  tool: {
    name: 'update_mod',
    description: 'Return an improved version of the mod with a changelog.',
    input_schema: {
      type: 'object',
      properties: {
        improvementSummary: { type: 'string', description: 'One sentence naming the concrete improvement (used as commit message)' },
        changelog:          { type: 'string', description: `Markdown changelog for v${nextVersion}: what was added/changed/fixed and why it matters to players` },
        javaCode:           { type: 'string', description: 'Complete, compilable Java source for ModMain.java including the improvement' },
        features:           { type: 'array', items: { type: 'string' }, description: 'Updated full feature keyword list (3-6 items)' }
      },
      required: ['improvementSummary', 'changelog', 'javaCode', 'features'],
      additionalProperties: false
    }
  },
  prompt: `You are the maintainer of the Minecraft Fabric 1.21.1 mod "${meta.name}" (${modId}).

Summary: ${meta.description}
Current features: ${(meta.features || []).join(', ')}

Release history:
${history}

Your task: implement ONE meaningful improvement for version ${nextVersion} and call the update_mod tool.
Pick the most valuable of these, based on the current code:
- a small new capability that players would notice and that fits the mod's purpose
- a configuration option (constants → simple in-code config with sensible defaults, or a /command to toggle behaviour)
- a real bug fix or robustness fix (edge cases, performance on busy servers, message spam)

RULES:
- The change must be substantial enough that the changelog is honest and specific. No cosmetic-only or "maintenance" updates.
- Keep ALL existing behaviour unless it is a bug.
- STRICT COMPILE RULES: Fabric API 0.102.0+1.21.1, Java 21, package com.factory.mod, class ModMain implements ModInitializer, server-side only, no net.minecraft.client.*, no mixins/reflection. Use only APIs you are certain exist in 1.21.1.
- Return the COMPLETE source file.

Current source:
\`\`\`java
${javaCode}
\`\`\``
});

const hash = s => crypto.createHash('sha256').update(s.replace(/\s+/g, ' ').trim()).digest('hex');
if (hash(result.javaCode) === hash(javaCode)) throw new Error('Claude returned unchanged source — refusing to publish a no-op update');
if (!result.changelog || result.changelog.trim().length < 40) throw new Error('Changelog too short for a real update');

meta.version = nextVersion;
meta.features = [...new Set([...(meta.features || []), ...(result.features || [])])].slice(0, 8);
meta.changelog = [...(meta.changelog || []), { version: nextVersion, date: new Date().toISOString().slice(0, 10), text: result.changelog }];
meta.lastImprovement = result.improvementSummary;
saveMod(modId, { meta, javaCode: result.javaCode });

console.log(`Improved ${meta.name} → v${nextVersion}: ${result.improvementSummary}`);
setOutputs({ modId, version: nextVersion, summary: result.improvementSummary });
