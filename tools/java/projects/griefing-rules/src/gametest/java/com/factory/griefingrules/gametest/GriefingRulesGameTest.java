package com.factory.griefingrules.gametest;

import com.factory.griefingrules.GriefingRules.Kind;
import com.factory.griefingrules.GriefingRulesMod;
import java.util.List;
import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.block.LeavesBlock;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.boss.WitherEntity;
import net.minecraft.entity.mob.CreeperEntity;
import net.minecraft.entity.mob.EndermanEntity;
import net.minecraft.entity.mob.RavagerEntity;
import net.minecraft.entity.passive.ChickenEntity;
import net.minecraft.entity.passive.PigEntity;
import net.minecraft.entity.projectile.ExplosiveProjectileEntity;
import net.minecraft.item.Items;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.test.GameTest;
import net.minecraft.test.GameTestException;
import net.minecraft.test.TestContext;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.GameRules;

/**
 * In-world tests on a headless game test server (gradlew :griefing-rules:runGametest).
 *
 * <p>Gamerules belong to the whole server, so every test that sets them has its own batch
 * (batches run one after the other, the tests of one batch at the same time) and sets all rules
 * itself at the start. The mobs and projectiles are real vanilla entities going their own way:
 * the creeper is lit and explodes after its fuse, fireballs and wither skulls fly into the ground,
 * the wither is hurt and breaks out, the enderman picks blocks on its own, the ravager walks into
 * leaves.
 */
public class GriefingRulesGameTest implements FabricGameTest {
    private static final int PLATFORM = 25; // 5×5 dirt at y 1, from 2,1,2 to 6,1,6

    private static void setRules(TestContext ctx, boolean mobGriefing, Kind... off) {
        ServerWorld world = ctx.getWorld();
        MinecraftServer server = world.getServer();
        GameRules rules = world.getGameRules();
        rules.get(GameRules.DO_MOB_GRIEFING).set(mobGriefing, server);
        List<Kind> switchedOff = List.of(off);
        for (Kind kind : Kind.values()) rules.get(GriefingRulesMod.key(kind)).set(!switchedOff.contains(kind), server);
    }

    private static void fill(TestContext ctx, BlockState state, int x1, int y1, int z1, int x2, int y2, int z2) {
        for (BlockPos pos : BlockPos.iterate(x1, y1, z1, x2, y2, z2)) ctx.setBlockState(pos.toImmutable(), state);
    }

    private static void fill(TestContext ctx, Block block, int x1, int y1, int z1, int x2, int y2, int z2) {
        fill(ctx, block.getDefaultState(), x1, y1, z1, x2, y2, z2);
    }

    private static int count(TestContext ctx, Block block, int x1, int y1, int z1, int x2, int y2, int z2) {
        int n = 0;
        for (BlockPos pos : BlockPos.iterate(x1, y1, z1, x2, y2, z2)) if (ctx.getBlockState(pos).isOf(block)) n++;
        return n;
    }

    private static void platform(TestContext ctx) {
        fill(ctx, Blocks.DIRT, 2, 1, 2, 6, 1, 6);
    }

    private static int platformLeft(TestContext ctx) {
        return count(ctx, Blocks.DIRT, 2, 1, 2, 6, 1, 6);
    }

    private static int fire(TestContext ctx) {
        return count(ctx, Blocks.FIRE, 0, 0, 0, 7, 7, 7);
    }

    private static void fail(String message) {
        throw new GameTestException(message);
    }

    /** Runs the check every tick until it passes (then the test succeeds) or the tick limit is reached. */
    private static void succeedWhen(TestContext ctx, Runnable check) {
        // not ctx.addFinalTask: in 1.21.1 it expects the check to pass in the very first tick
        ctx.createTimedTaskRunner().createAndAdd(check).completeIfSuccessful();
    }

    // --- the rules themselves ---

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_command")
    public void theRulesExistAndTheGameruleCommandSetsThem(TestContext ctx) {
        setRules(ctx, true);
        GameRules fresh = new GameRules();
        for (Kind kind : Kind.values()) {
            GameRules.Key<GameRules.BooleanRule> key = GriefingRulesMod.key(kind);
            ctx.assertTrue(key != null && key.getName().equals(kind.ruleName()), "rule " + kind.ruleName() + " is registered");
            ctx.assertTrue(key.getCategory() == GameRules.Category.MOBS, kind.ruleName() + " is listed under Mobs");
            ctx.assertTrue(fresh.getBoolean(key), kind.ruleName() + " is on in a new world");
        }
        MinecraftServer server = ctx.getWorld().getServer();
        server.getCommandManager().executeWithPrefix(server.getCommandSource(), "gamerule creeperGriefing false");
        ctx.assertFalse(ctx.getWorld().getGameRules().getBoolean(GriefingRulesMod.key(Kind.CREEPER)), "/gamerule creeperGriefing false switches it off");
        ctx.assertTrue(ctx.getWorld().getGameRules().getBoolean(GameRules.DO_MOB_GRIEFING), "mobGriefing is left alone");
        server.getCommandManager().executeWithPrefix(server.getCommandSource(), "gamerule creeperGriefing true");
        ctx.assertTrue(ctx.getWorld().getGameRules().getBoolean(GriefingRulesMod.key(Kind.CREEPER)), "/gamerule creeperGriefing true switches it on");
        ctx.complete();
    }

    // --- creepers ---

    private static void creeperBlast(TestContext ctx, boolean blocksBreak) {
        platform(ctx);
        CreeperEntity creeper = ctx.spawnEntity(EntityType.CREEPER, new Vec3d(4.5, 2, 4.5));
        creeper.setAiDisabled(true);
        PigEntity pig = ctx.spawnEntity(EntityType.PIG, new Vec3d(6.5, 2, 4.5));
        pig.setAiDisabled(true);
        float pigHealth = pig.getHealth();
        creeper.ignite();
        // the fuse is 30 ticks
        ctx.waitAndRun(50, () -> {
            ctx.assertTrue(creeper.isRemoved(), "the creeper exploded");
            ctx.assertTrue(pig.isDead() || pig.isRemoved() || pig.getHealth() < pigHealth, "the blast still hurts the pig next to it");
            int left = platformLeft(ctx);
            if (blocksBreak) ctx.assertTrue(left < PLATFORM, "the blast breaks dirt, " + left + " of " + PLATFORM + " left");
            else ctx.assertTrue(left == PLATFORM, "no block breaks, " + left + " of " + PLATFORM + " left");
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_creeper_off", tickLimit = 100)
    public void creeperGriefingOffKeepsTheBlocks(TestContext ctx) {
        setRules(ctx, true, Kind.CREEPER);
        creeperBlast(ctx, false);
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_creeper_on", tickLimit = 100)
    public void creeperGriefingOnBreaksBlocksAsInVanilla(TestContext ctx) {
        setRules(ctx, true);
        creeperBlast(ctx, true);
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_vanilla_off", tickLimit = 100)
    public void mobGriefingOffStillTurnsEverythingOff(TestContext ctx) {
        setRules(ctx, false);
        creeperBlast(ctx, false);
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_creeper_other_off", tickLimit = 100)
    public void otherRulesDoNotStopCreepers(TestContext ctx) {
        setRules(ctx, true, Kind.GHAST, Kind.WITHER, Kind.ENDERMAN, Kind.RAVAGER);
        creeperBlast(ctx, true);
    }

    // --- ghast fireballs and wither skulls: real projectiles flying into the platform ---

    private static void projectileBlast(TestContext ctx, EntityType<? extends ExplosiveProjectileEntity> type, boolean blocksBreak) {
        platform(ctx);
        ExplosiveProjectileEntity shot = ctx.spawnEntity(type, new Vec3d(4.5, 4.5, 4.5));
        shot.setVelocity(0, -0.5, 0);
        ctx.waitAndRun(30, () -> {
            ctx.assertTrue(shot.isRemoved(), "the " + type.getName().getString() + " hit the ground and exploded");
            int left = platformLeft(ctx);
            if (blocksBreak) ctx.assertTrue(left < PLATFORM, "the blast breaks dirt, " + left + " of " + PLATFORM + " left");
            else {
                ctx.assertTrue(left == PLATFORM, "no block breaks, " + left + " of " + PLATFORM + " left");
                ctx.assertTrue(fire(ctx) == 0, "no fire is lit");
            }
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_ghast_off", tickLimit = 100)
    public void ghastGriefingOffKeepsBlocksAndLightsNoFire(TestContext ctx) {
        setRules(ctx, true, Kind.GHAST);
        projectileBlast(ctx, EntityType.FIREBALL, false);
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_ghast_on", tickLimit = 100)
    public void ghastGriefingOnBreaksBlocks(TestContext ctx) {
        setRules(ctx, true);
        projectileBlast(ctx, EntityType.FIREBALL, true);
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_skull_off", tickLimit = 100)
    public void witherGriefingOffKeepsBlocksUnderASkull(TestContext ctx) {
        setRules(ctx, true, Kind.WITHER);
        projectileBlast(ctx, EntityType.WITHER_SKULL, false);
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_skull_on", tickLimit = 100)
    public void witherGriefingOnLetsASkullBreakBlocks(TestContext ctx) {
        setRules(ctx, true);
        projectileBlast(ctx, EntityType.WITHER_SKULL, true);
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_ghast_creeper_off", tickLimit = 100)
    public void creeperRuleDoesNotStopGhastFireballs(TestContext ctx) {
        setRules(ctx, true, Kind.CREEPER);
        projectileBlast(ctx, EntityType.FIREBALL, true);
    }

    // --- the wither breaking out of a box after it is hurt ---

    private static void witherBreaksOut(TestContext ctx, boolean blocksBreak) {
        fill(ctx, Blocks.DIRT, 3, 0, 3, 5, 5, 5);
        fill(ctx, Blocks.AIR, 4, 1, 4, 4, 4, 4);
        int around = count(ctx, Blocks.DIRT, 3, 1, 3, 5, 4, 5); // what mobTick's box reaches: 8 × 4 blocks
        WitherEntity wither = ctx.spawnEntity(EntityType.WITHER, new Vec3d(4.5, 1, 4.5));
        ctx.assertTrue(wither.getInvulnerableTimer() == 0, "the wither is not in its spawn phase");
        ctx.assertTrue(wither.damage(ctx.getWorld().getDamageSources().generic(), 1.0F), "the wither takes a hit");
        // the hit sets a cooldown of 20 ticks, then mobTick breaks the blocks around it
        ctx.waitAndRun(40, () -> {
            int left = count(ctx, Blocks.DIRT, 3, 1, 3, 5, 4, 5);
            wither.discard();
            if (blocksBreak) ctx.assertTrue(left < around, "the wither breaks out, " + left + " of " + around + " left");
            else ctx.assertTrue(left == around, "the box stays whole, " + left + " of " + around + " left");
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_wither_box_off", tickLimit = 100)
    public void witherGriefingOffKeepsTheWitherBoxed(TestContext ctx) {
        setRules(ctx, true, Kind.WITHER);
        witherBreaksOut(ctx, false);
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_wither_box_on", tickLimit = 100)
    public void witherGriefingOnLetsTheWitherBreakOut(TestContext ctx) {
        setRules(ctx, true);
        witherBreaksOut(ctx, true);
    }

    // --- wither roses ---

    private static void witherKills(TestContext ctx, boolean rosePlanted) {
        fill(ctx, Blocks.DIRT, 3, 1, 3, 5, 1, 5);
        BlockPos spot = new BlockPos(4, 2, 4);
        ChickenEntity chicken = ctx.spawnEntity(EntityType.CHICKEN, new Vec3d(4.5, 2, 4.5));
        chicken.setAiDisabled(true);
        WitherEntity wither = EntityType.WITHER.create(ctx.getWorld()); // only the attacker, never added to the world
        ctx.assertTrue(chicken.damage(ctx.getWorld().getDamageSources().mobAttack(wither), 100.0F), "the wither hits the chicken");
        ctx.assertTrue(chicken.isDead(), "the chicken dies");
        long roseItems = ctx.getEntitiesAround(EntityType.ITEM, spot, 2.0).stream().map(ItemEntity::getStack).filter(s -> s.isOf(Items.WITHER_ROSE)).count();
        if (rosePlanted) {
            ctx.expectBlock(Blocks.WITHER_ROSE, spot);
            ctx.assertTrue(roseItems == 0, "no rose item besides the planted one");
        } else {
            ctx.expectBlock(Blocks.AIR, spot);
            ctx.assertTrue(roseItems == 1, "the rose drops as an item instead, found " + roseItems);
        }
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_rose_off")
    public void witherGriefingOffDropsTheRose(TestContext ctx) {
        setRules(ctx, true, Kind.WITHER);
        witherKills(ctx, false);
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_rose_on")
    public void witherGriefingOnPlantsTheRose(TestContext ctx) {
        setRules(ctx, true);
        witherKills(ctx, true);
    }

    // --- endermen: shut in a dirt box, they pick blocks from its walls on their own ---

    private static EndermanEntity boxedEnderman(TestContext ctx) {
        fill(ctx, Blocks.DIRT, 2, 0, 2, 6, 4, 6);
        fill(ctx, Blocks.AIR, 4, 1, 4, 4, 3, 4);
        return ctx.spawnEntity(EntityType.ENDERMAN, new Vec3d(4.5, 1, 4.5));
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_enderman_off", tickLimit = 400)
    public void endermanGriefingOffTakesNoBlock(TestContext ctx) {
        setRules(ctx, true, Kind.ENDERMAN);
        EndermanEntity enderman = boxedEnderman(ctx);
        int walls = count(ctx, Blocks.DIRT, 2, 0, 2, 6, 4, 6);
        ctx.runAtEveryTick(() -> {
            if (enderman.getCarriedBlock() != null) fail("the enderman took " + enderman.getCarriedBlock());
        });
        // with the rule on it takes one after about 80 ticks (see the next test); 300 ticks without one
        ctx.waitAndRun(300, () -> {
            int left = count(ctx, Blocks.DIRT, 2, 0, 2, 6, 4, 6);
            enderman.discard();
            ctx.assertTrue(left == walls, "the box stays whole, " + left + " of " + walls);
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_enderman_on", tickLimit = 800)
    public void endermanGriefingOnTakesABlock(TestContext ctx) {
        setRules(ctx, true);
        EndermanEntity enderman = boxedEnderman(ctx);
        // each try (about one per 20 ticks) hits a wall next to it with a chance of about 1 in 4
        succeedWhen(ctx, () -> {
            if (enderman.getCarriedBlock() == null) fail("the enderman has not taken a block yet");
            enderman.discard();
        });
    }

    // --- ravagers: pushed into a wall of leaves ---

    private static void ravagerPush(TestContext ctx, boolean leavesBreak) {
        fill(ctx, Blocks.STONE, 0, 0, 0, 7, 0, 7);
        BlockState leaves = Blocks.OAK_LEAVES.getDefaultState().with(LeavesBlock.PERSISTENT, true);
        fill(ctx, leaves, 6, 1, 2, 6, 3, 6);
        int wall = count(ctx, Blocks.OAK_LEAVES, 6, 1, 2, 6, 3, 6);
        RavagerEntity ravager = ctx.spawnEntity(EntityType.RAVAGER, new Vec3d(3.5, 1, 4.5));
        ctx.runAtEveryTick(() -> ravager.setVelocity(0.3, ravager.getVelocity().y, 0));
        if (leavesBreak) {
            succeedWhen(ctx, () -> {
                int left = count(ctx, Blocks.OAK_LEAVES, 6, 1, 2, 6, 3, 6);
                if (left >= wall) fail("the ravager has not broken leaves yet");
                ravager.discard();
            });
        } else {
            ctx.waitAndRun(60, () -> {
                int left = count(ctx, Blocks.OAK_LEAVES, 6, 1, 2, 6, 3, 6);
                ctx.assertTrue(ravager.horizontalCollision || ravager.getBoundingBox().maxX > ctx.getAbsolute(new Vec3d(5.9, 0, 0)).x, "the ravager reached the wall");
                ravager.discard();
                ctx.assertTrue(left == wall, "the leaves stay, " + left + " of " + wall);
                ctx.complete();
            });
        }
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_ravager_off", tickLimit = 100)
    public void ravagerGriefingOffKeepsTheLeaves(TestContext ctx) {
        setRules(ctx, true, Kind.RAVAGER);
        ravagerPush(ctx, false);
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "griefingrules_ravager_on", tickLimit = 100)
    public void ravagerGriefingOnBreaksLeaves(TestContext ctx) {
        setRules(ctx, true);
        ravagerPush(ctx, true);
    }
}
