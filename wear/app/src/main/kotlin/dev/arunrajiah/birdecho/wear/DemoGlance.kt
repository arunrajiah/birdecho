package dev.arunrajiah.birdecho.wear

import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Sample data for the demo station, matching the phone app's demo station
 * (src/api/adapters/demo.ts). Works without a phone, account or network, so the
 * watch app can be tried on its own.
 */
internal object DemoGlance {
    private val SPECIES = listOf(
        "American Robin", "Northern Cardinal", "Blue Jay", "House Sparrow",
        "American Goldfinch", "Black-capped Chickadee", "Mourning Dove", "Song Sparrow",
    )

    fun at(now: LocalDateTime): Glance {
        // A new "detection" every few minutes, so refreshing visibly changes the glance.
        val slot = now.hour * 12 + now.minute / 5
        val detectedAt = now.minusMinutes((now.minute % 5).toLong())
        return Glance(
            lastSpecies = SPECIES[slot % SPECIES.size],
            lastTime = detectedAt.format(DateTimeFormatter.ofPattern("HH:mm")),
            todayCount = 12 + slot * 2,
            todayCapped = false,
            fetchedAtMillis = System.currentTimeMillis(),
        )
    }
}
