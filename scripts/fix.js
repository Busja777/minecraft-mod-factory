import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const mod = JSON.parse(fs.readFileSync('./generated-mod.json', 'utf-8'));

const buildOutput = fs.existsSync('./build-output.txt')
  ? fs.readFileSync('./build-output.txt', 'utf-8')
  : '';

const errors = buildOutput
  .split('\n')
  .filter(l => l.match(/error:|cannot find symbol|symbol:|location:/))
  .slice(0, 30)
  .join('\n');

console.log('Compile errors found:\n' + errors);
console.log('\nSending to Claude for fix...');

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  tools: [{
    name: 'fix_code',
    description: 'Return fixed, compilable Java code',
    input_schema: {
      type: 'object',
      properties: { javaCode: { type: 'string', description: 'Complete fixed Java source code' } },
      required: ['javaCode']
    }
  }],
  tool_choice: { type: 'tool', name: 'fix_code' },
  messages: [{
    role: 'user',
    content: `Fix the Java compile errors below. This is a Minecraft Fabric 1.21.1 mod.

RULES:
- Package: com.factory.mod | Class: ModMain implements ModInitializer
- ONLY use APIs in Fabric API 0.102.0+1.21.1 + Java 21
- BANNED: setStepHeight(), getStepHeight() → use EntityAttributes.GENERIC_STEP_HEIGHT
- BANNED: any Client-side classes in server entrypoint
- Keep it simple — prefer ServerTickEvents, UseEntityCallback, PlayerBlockBreakEvents

Current code:
\`\`\`java
${mod.javaCode}
\`\`\`

Compile errors:
${errors}`
  }]
});

const fix = response.content.find(b => b.type === 'tool_use');
if (!fix) throw new Error('Claude did not return a fix');

mod.javaCode = fix.input.javaCode;
fs.writeFileSync('./generated-mod.json', JSON.stringify(mod, null, 2));
console.log('Fix applied successfully.');
