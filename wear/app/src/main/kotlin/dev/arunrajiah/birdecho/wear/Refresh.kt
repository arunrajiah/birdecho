package dev.arunrajiah.birdecho.wear

import android.content.Context
import androidx.wear.tiles.TileService
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Fetches the glance, caches it and asks the system to redraw the tile. */
suspend fun refreshGlance(context: Context): Boolean = withContext(Dispatchers.IO) {
    val store = Store(context)
    val station = store.station?.takeIf { it.isSupported } ?: return@withContext false
    try {
        store.glance = StationApi.fetchGlance(station)
        TileService.getUpdater(context).requestUpdate(GlanceTileService::class.java)
        true
    } catch (_: IOException) {
        false
    } catch (_: org.json.JSONException) {
        false
    }
}

class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result =
        if (refreshGlance(applicationContext)) Result.success() else Result.retry()

    companion object {
        private const val PERIODIC = "glance-periodic"
        private const val ONCE = "glance-once"
        private val connected = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        /** 15 minutes is WorkManager's minimum period; the system may stretch it to save battery. */
        fun schedule(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC,
                ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES)
                    .setConstraints(connected)
                    .build(),
            )
        }

        fun refreshNow(context: Context) {
            WorkManager.getInstance(context).enqueueUniqueWork(
                ONCE,
                ExistingWorkPolicy.KEEP,
                OneTimeWorkRequestBuilder<RefreshWorker>().setConstraints(connected).build(),
            )
        }
    }
}
