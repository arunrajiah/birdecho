package dev.arunrajiah.birdecho.wear

/**
 * Parsers for BirdNET-Pi's HTML endpoints, ported from the phone app's adapter
 * (src/api/adapters/birdnetpi.ts). Pure Kotlin so they run in JVM unit tests.
 * Both forks (Nachtzuster, mcguirepr89) emit one </tr> after the last row
 * rather than one per row, so rows are split on <tr> openings.
 */
internal object BirdNetPiHtml {
    private val ENTITIES = mapOf(
        "&amp;" to "&", "&lt;" to "<", "&gt;" to ">", "&quot;" to "\"",
        "&#039;" to "'", "&#39;" to "'", "&apos;" to "'", "&nbsp;" to " ",
    )
    private val ENTITY_RE = Regex("&(?:amp|lt|gt|quot|apos|nbsp|#0?39);")
    private val TAG_RE = Regex("<[^>]+>")
    private val SPACE_RE = Regex("\\s+")
    private val CELL_RE = Regex("<td[^>]*>([\\s\\S]*?)</td>", RegexOption.IGNORE_CASE)
    private val ROW_START_RE = Regex("<tr\\b[^>]*>", RegexOption.IGNORE_CASE)
    private val NAME_RE =
        Regex("<(a|button)\\b[^>]*class=[\"']a2[\"'][^>]*>([\\s\\S]*?)</\\1>", RegexOption.IGNORE_CASE)
    private val TIME_RE = Regex("\\b(\\d{1,2}):(\\d{2}):(\\d{2})\\b")

    fun text(html: String): String =
        ENTITY_RE.replace(TAG_RE.replace(html, " ")) { ENTITIES[it.value] ?: it.value }
            .replace(SPACE_RE, " ")
            .trim()

    /** "Today" from /todays_detections.php?today_stats=true (Total | Today | Last hour | ...). */
    fun todayCount(statsHtml: String): Int? =
        CELL_RE.findAll(statsHtml)
            .map { text(it.groupValues[1]) }
            .filter { it.isNotEmpty() && it.all(Char::isDigit) }
            .map { it.toInt() }
            .elementAtOrNull(1)

    /**
     * Newest detection from /todays_detections.php?ajax_detections=true&display_limit=40
     * as (common name, "HH:mm:ss"), or null on a day without detections.
     */
    fun latest(detectionsHtml: String): Pair<String, String>? {
        for (row in detectionsHtml.split(ROW_START_RE).drop(1)) {
            val name = NAME_RE.find(row)?.groupValues?.get(2)?.let(::text).orEmpty()
            val time = TIME_RE.find(text(row)) ?: continue
            if (name.isEmpty()) continue
            val (h, m, s) = time.destructured
            return name to "${h.padStart(2, '0')}:$m:$s"
        }
        return null
    }
}
