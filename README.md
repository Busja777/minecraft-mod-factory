# Minecraft Mod Factory

Automated pipeline: Claude API generates Fabric 1.21.1 QoL mods → fal.ai generates thumbnails → Gradle builds .jar → uploads to CurseForge + Modrinth.

Runs 3× per week (Mon/Wed/Fri 10:00 UTC) via GitHub Actions.

## Required Secrets
- `ANTHROPIC_API_KEY`
- `FAL_API_KEY`
- `CF_API_TOKEN`
- `CF_PROJECT_IDS` (comma-separated)
- `MODRINTH_API_TOKEN`
