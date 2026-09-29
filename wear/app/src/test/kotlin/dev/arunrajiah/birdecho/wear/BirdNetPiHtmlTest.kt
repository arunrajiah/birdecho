package dev.arunrajiah.birdecho.wear

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDateTime

/** Fixtures are real output of each BirdNET-Pi fork (shared with the phone app's tests/fixtures). */
class BirdNetPiHtmlTest {
    private fun fixture(name: String): String =
        javaClass.classLoader!!.getResource(name)!!.readText()

    @Test
    fun latestDetectionOnBothForks() {
        for (fork in listOf("nachtzuster", "mcguirepr89")) {
            assertEquals(fork, "Blue Jay" to "17:14:58", BirdNetPiHtml.latest(fixture("pi-$fork-detections.html")))
        }
    }

    @Test
    fun todayCountOnBothForks() {
        for (fork in listOf("nachtzuster", "mcguirepr89")) {
            assertEquals(fork, 95, BirdNetPiHtml.todayCount(fixture("pi-$fork-stats.html")))
        }
    }

    @Test
    fun dayWithoutDetections() {
        assertNull(BirdNetPiHtml.latest(fixture("pi-nachtzuster-empty.html")))
    }

    @Test
    fun decodesApostrophes() {
        val row = "<tr><td>08:01:02<b><a class=\"a2\" href=\"#\">Anna&#039;s Hummingbird</a></b></td>"
        assertEquals("Anna's Hummingbird" to "08:01:02", BirdNetPiHtml.latest(row))
    }

    @Test
    fun demoGlanceNeedsNoNetwork() {
        val glance = DemoGlance.at(LocalDateTime.of(2026, 9, 29, 9, 17))
        assertEquals("09:15", glance.lastTime)
        assertEquals(12 + (9 * 12 + 3) * 2, glance.todayCount)
        assert(!glance.lastSpecies.isNullOrBlank())
    }

    @Test
    fun demoAndBirdNetPiStationsAreSupported() {
        assert(StationConfig.DEMO.isSupported)
        assert(StationConfig("birdnetpi", "Pi", null, null, "http://pi.local").isSupported)
    }
}
