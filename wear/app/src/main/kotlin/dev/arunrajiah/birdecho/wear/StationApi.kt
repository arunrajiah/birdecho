package dev.arunrajiah.birdecho.wear

import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/**
 * Minimal Kotlin port of the two calls the glance needs from the phone app's
 * adapters (src/api/records.ts + stats.ts for BirdWeather,
 * src/api/adapters/birdnetgo.ts for BirdNET-Go, src/api/adapters/birdnetpi.ts for
 * BirdNET-Pi). Keep the endpoints in sync.
 */
object StationApi {
    private const val BIRDWEATHER_BASE = "https://app.birdweather.com/api/v1"

    /** Blocking. Call from a background dispatcher. */
    @Throws(IOException::class)
    fun fetchGlance(station: StationConfig): Glance = when (station.connectionType) {
        StationConfig.TYPE_BIRDWEATHER -> birdWeather(station)
        StationConfig.TYPE_BIRDNETGO -> birdNetGo(station)
        StationConfig.TYPE_BIRDNETPI -> birdNetPi(station)
        StationConfig.TYPE_DEMO -> DemoGlance.at(LocalDateTime.now())
        else -> throw IOException("Unsupported station type: ${station.connectionType}")
    }

    private fun birdWeather(station: StationConfig): Glance {
        val base = "$BIRDWEATHER_BASE/stations/${station.bwStationId}"
        val headers = station.token?.takeIf { it.isNotBlank() }
            ?.let { mapOf("X-Auth-Token" to it) } ?: emptyMap()

        val latest = JSONObject(get("$base/detections?limit=1", headers))
            .optJSONArray("detections").firstOrNull()
        // /stats defaults to period=day. Do not count a /detections page instead:
        // that endpoint ignores ?period= and returns the latest rows of any date.
        val today = JSONObject(get("$base/stats?period=day", headers)).optInt("detections", 0)

        return Glance(
            lastSpecies = latest?.optJSONObject("species")?.optString("commonName")?.takeIf { it.isNotBlank() },
            lastTime = latest?.optString("timestamp")?.let(::formatTimestamp),
            todayCount = today,
            todayCapped = false,
            fetchedAtMillis = System.currentTimeMillis(),
        )
    }

    private fun birdNetGo(station: StationConfig): Glance {
        val base = station.hostUrl!!.trimEnd('/') + "/api/v2"
        val latest = JSONObject(get("$base/detections?limit=1&offset=0&order=desc"))
            .optJSONArray("data").firstOrNull()
        val day = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        val today = JSONObject(get("$base/analytics/time/daily?start_date=$day&end_date=$day"))
            .optInt("total", 0)

        return Glance(
            lastSpecies = latest?.optString("commonName")?.takeIf { it.isNotBlank() },
            lastTime = latest?.optString("timestamp")?.let(::formatTimestamp),
            todayCount = today,
            todayCapped = false,
            fetchedAtMillis = System.currentTimeMillis(),
        )
    }

    private fun birdNetPi(station: StationConfig): Glance {
        val base = station.hostUrl!!.trimEnd('/')
        val latest = BirdNetPiHtml.latest(
            get("$base/todays_detections.php?ajax_detections=true&display_limit=40"),
        )
        val today = BirdNetPiHtml.todayCount(get("$base/todays_detections.php?today_stats=true"))
            ?: throw IOException("Unrecognised BirdNET-Pi stats page")
        return Glance(
            lastSpecies = latest?.first,
            // BirdNET-Pi only lists today's detections, in the station's local time.
            lastTime = latest?.second?.let { formatTimestamp("${LocalDate.now()}T$it") },
            todayCount = today,
            todayCapped = false,
            fetchedAtMillis = System.currentTimeMillis(),
        )
    }

    private fun JSONArray?.firstOrNull(): JSONObject? =
        if (this != null && length() > 0) optJSONObject(0) else null

    private val TIME = DateTimeFormatter.ofPattern("HH:mm")
    private val DAY_TIME = DateTimeFormatter.ofPattern("d MMM HH:mm")
    private val SPACE_SEPARATED = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

    /**
     * Station-local wall-clock time. Timestamps with an offset keep the station's
     * own local time (not the watch's zone), matching what the phone app shows.
     */
    internal fun formatTimestamp(raw: String): String? {
        if (raw.isBlank()) return null
        val local: LocalDateTime = try {
            OffsetDateTime.parse(raw).toLocalDateTime()
        } catch (_: DateTimeParseException) {
            try {
                LocalDateTime.parse(raw)
            } catch (_: DateTimeParseException) {
                try {
                    LocalDateTime.parse(raw, SPACE_SEPARATED)
                } catch (_: DateTimeParseException) {
                    return null
                }
            }
        }
        val sameDay = local.toLocalDate() == LocalDate.now()
        return local.format(if (sameDay) TIME else DAY_TIME)
    }

    private fun get(url: String, headers: Map<String, String> = emptyMap()): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 10_000
            conn.readTimeout = 15_000
            conn.setRequestProperty("Accept", "application/json, text/html")
            headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
            val code = conn.responseCode
            if (code !in 200..299) throw IOException("HTTP $code")
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }
}
