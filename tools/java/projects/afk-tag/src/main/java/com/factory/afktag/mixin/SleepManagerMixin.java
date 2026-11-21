package com.factory.afktag.mixin;

import com.factory.afktag.AfkTag;
import java.util.List;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.SleepManager;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

/**
 * Leaves AFK players out of the night-skip vote (config {@code ignoreAfkForSleep}). In 1.21.1 the
 * whole vote lives in {@code SleepManager}, and both of its methods that look at players get the
 * world's player list as an argument (ServerWorld passes its {@code players}):
 * <ul>
 *   <li>{@code update(List)} counts {@code total} (every non-spectator) and {@code sleeping}; the
 *       cached numbers decide {@code canSkipNight} and the "x/y players sleeping" message.</li>
 *   <li>{@code canResetTime(int, List)} counts the players who have been in bed long enough
 *       (100 ticks) before ServerWorld#tick actually skips the night.</li>
 * </ul>
 * Fabric API has no event for this count (EntitySleepEvents only covers starting, stopping and
 * bed checks), so a mixin is the only way. Replacing the list argument at HEAD with a filtered copy
 * changes exactly who is counted, keeps vanilla's own arithmetic (percentage, rounding, spectators)
 * and never touches the world's real list. AFK players then count like spectators: neither
 * sleeping nor required.
 */
@Mixin(SleepManager.class)
abstract class SleepManagerMixin {
    @ModifyVariable(method = {"update", "canResetTime"}, at = @At("HEAD"), argsOnly = true, require = 2)
    private List<ServerPlayerEntity> afktag$withoutAfkPlayers(List<ServerPlayerEntity> players) {
        return AfkTag.sleepCounted(players);
    }
}
