package com.factory.patientanvil;

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Entry point. All the work is done by the two mixins (see the mixin package); this class only
 * reports that the mod is loaded.
 */
public final class PatientAnvil implements ModInitializer {
    public static final String MOD_ID = "patientanvil";
    public static final Logger LOG = LoggerFactory.getLogger("Patient Anvil");

    @Override
    public void onInitialize() {
        LOG.info("The anvil has no \"Too Expensive!\" limit; costs stay as in vanilla");
    }
}
