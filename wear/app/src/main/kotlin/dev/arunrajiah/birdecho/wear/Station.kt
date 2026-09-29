package dev.arunrajiah.birdecho.wear

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** Station connection details, sent once from the phone app over the Data Layer. */
data class StationConfig(
    val connectionType: String,
    val stationName: String,
    val bwStationId: String?,
    val token: String?,
    val hostUrl: String?,
) {
    val isSupported: Boolean
        get() = when (connectionType) {
            TYPE_BIRDWEATHER -> !bwStationId.isNullOrBlank()
            TYPE_BIRDNETGO, TYPE_BIRDNETPI -> !hostUrl.isNullOrBlank()
            TYPE_DEMO -> true
            else -> false
        }

    companion object {
        const val TYPE_BIRDWEATHER = "birdweather"
        const val TYPE_BIRDNETGO = "birdnetgo"
        const val TYPE_BIRDNETPI = "birdnetpi"
        const val TYPE_DEMO = "demo"

        /** The demo station, available on the watch without a phone. */
        val DEMO = StationConfig(TYPE_DEMO, "Demo station", null, null, null)
    }
}

/** What the tile and the app show. Cached so both render without a network call. */
data class Glance(
    val lastSpecies: String?,
    /** Station-local wall-clock time of the last detection, already formatted. */
    val lastTime: String?,
    val todayCount: Int,
    /** True when todayCount hit the API page limit, so the real number may be higher. */
    val todayCapped: Boolean,
    val fetchedAtMillis: Long,
)

class Store(context: Context) {
    // The BirdWeather token lives here, so the whole file is encrypted at rest.
    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "birdecho_wear",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    var station: StationConfig?
        get() {
            val type = prefs.getString(K_TYPE, null) ?: return null
            return StationConfig(
                connectionType = type,
                stationName = prefs.getString(K_NAME, null) ?: "",
                bwStationId = prefs.getString(K_BW_ID, null),
                token = prefs.getString(K_TOKEN, null),
                hostUrl = prefs.getString(K_HOST, null),
            )
        }
        set(value) {
            prefs.edit().apply {
                if (value == null) {
                    listOf(K_TYPE, K_NAME, K_BW_ID, K_TOKEN, K_HOST).forEach { remove(it) }
                } else {
                    putString(K_TYPE, value.connectionType)
                    putString(K_NAME, value.stationName)
                    putString(K_BW_ID, value.bwStationId)
                    putString(K_TOKEN, value.token)
                    putString(K_HOST, value.hostUrl)
                }
                // A different station makes the cached glance wrong.
                listOf(K_SPECIES, K_TIME, K_COUNT, K_CAPPED, K_FETCHED).forEach { remove(it) }
            }.apply()
        }

    var glance: Glance?
        get() {
            if (!prefs.contains(K_FETCHED)) return null
            return Glance(
                lastSpecies = prefs.getString(K_SPECIES, null),
                lastTime = prefs.getString(K_TIME, null),
                todayCount = prefs.getInt(K_COUNT, 0),
                todayCapped = prefs.getBoolean(K_CAPPED, false),
                fetchedAtMillis = prefs.getLong(K_FETCHED, 0L),
            )
        }
        set(value) {
            if (value == null) return
            prefs.edit()
                .putString(K_SPECIES, value.lastSpecies)
                .putString(K_TIME, value.lastTime)
                .putInt(K_COUNT, value.todayCount)
                .putBoolean(K_CAPPED, value.todayCapped)
                .putLong(K_FETCHED, value.fetchedAtMillis)
                .apply()
        }

    private companion object {
        const val K_TYPE = "station_type"
        const val K_NAME = "station_name"
        const val K_BW_ID = "station_bw_id"
        const val K_TOKEN = "station_token"
        const val K_HOST = "station_host"
        const val K_SPECIES = "glance_species"
        const val K_TIME = "glance_time"
        const val K_COUNT = "glance_count"
        const val K_CAPPED = "glance_capped"
        const val K_FETCHED = "glance_fetched"
    }
}
