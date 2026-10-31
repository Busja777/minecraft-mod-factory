import fs from 'fs';
import { resolveWorkingMod } from './lib/mods.js';
import { callTool } from './lib/claude.js';

// One Claude-assisted fix attempt for compile errors in build-output.txt (L7).
const working = resolveWorkingMod(process.argv.slice(2));

const buildOutput = fs.existsSync('./build-output.txt') ? fs.readFileSync('./build-output.txt', 'utf-8') : '';
const errors = buildOutput.split('\n').filter(l => /error:|cannot find symbol|symbol:|location:/.test(l)).slice(0, 30).join('\n');

if (!errors) {
  console.log('No compile errors found in build-output.txt — nothing to fix.');
  process.exit(0);
}
console.log('Compile errors:\n' + errors + '\n\nSending to Claude for fix...');

const fix = await callTool({
  tool: {
    name: 'fix_code',
    description: 'Return fixed, compilable Java source code',
    input_schema: { type: 'object', properties: { javaCode: { type: 'string' } }, required: ['javaCode'] }
  },
  prompt: `Fix the Java compile errors below for a Minecraft Fabric 1.21.1 mod.

RULES:
- Package: com.factory.mod | Class: ModMain implements ModInitializer
- Only use APIs in Fabric API 0.102.0+1.21.1 + Java 21
- BANNED: setStepHeight(), getStepHeight() → use EntityAttributes.GENERIC_STEP_HEIGHT
- BANNED: any net.minecraft.client.* class
- Prefer ServerTickEvents, UseEntityCallback, PlayerBlockBreakEvents
- Keep every existing feature; only simplify a feature if it cannot be fixed otherwise

Current code:
\`\`\`java
${working.javaCode}
\`\`\`

Compile errors:
${errors}`
});

working.saveJava(fix.javaCode);
console.log(`Fix applied to ${working.source === 'stored' ? `data/mods/${working.modId}/ModMain.java` : 'generated-mod.json'}`);
