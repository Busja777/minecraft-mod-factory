package com.factory.stackmore;

import java.util.Map;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.item.v1.DefaultItemComponentEvents;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.item.Item;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Entry point: gives potions, eggs and snowballs a bigger stack size (see {@link StackRules}).
 *
 * <p>Since 1.20.5 an item's stack size is its default {@code minecraft:max_stack_size} component.
 * Fabric API's {@link DefaultItemComponentEvents#MODIFY} (fabric-item-api-v1, fired once at the
 * start of {@code Registries.freezeRegistries}) changes that default on the Item itself, so every
 * stack of the item, old or new, in any inventory, has the new size and stays equal to every other
 * stack of it: nothing is written into the stacks or the world.
 *
 * <p>The default components are not sent over the network: a stack travels as item, count and only
 * the components that differ from the item's default ({@code ComponentChanges}). A game without the
 * mod therefore still thinks a potion stacks to 1, so the mod is needed on the server and on every
 * player's game.
 */
public final class StackMore implements ModInitializer {
    public static final String MOD_ID = "stackmore";
    public static final Logger LOG = LoggerFactory.getLogger("Stack More");

    @Override
    public void onInitialize() {
        DefaultItemComponentEvents.MODIFY.register(context -> {
            for (Map.Entry<String, Integer> entry : StackRules.NEW_SIZES.entrySet()) {
                Identifier id = Identifier.of(entry.getKey());
                if (!Registries.ITEM.containsId(id)) {
                    LOG.warn("Unknown item {}, its stack size stays as it is", id);
                    continue;
                }
                Item item = Registries.ITEM.get(id);
                int vanilla = item.getMaxCount();
                boolean damageable = item.getComponents().contains(DataComponentTypes.MAX_DAMAGE);
                int size = StackRules.limitFor(entry.getKey(), vanilla);
                if (!StackRules.isAllowed(size, vanilla, damageable)) {
                    LOG.warn("Stack size {} is not allowed for {} (vanilla {}), left as it is", size, id, vanilla);
                    continue;
                }
                context.modify(item, builder -> builder.add(DataComponentTypes.MAX_STACK_SIZE, size));
            }
        });
    }
}
