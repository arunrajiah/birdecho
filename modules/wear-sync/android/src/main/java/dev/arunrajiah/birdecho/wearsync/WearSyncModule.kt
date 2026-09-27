package dev.arunrajiah.birdecho.wearsync

import android.net.Uri
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Path and keys must match wear/.../ConfigListenerService.kt on the watch side. */
private const val STATION_PATH = "/birdecho/station"
private val STRING_KEYS = listOf("connectionType", "stationName", "bwStationId", "token", "hostUrl")

/**
 * Both functions resolve false instead of rejecting when there is no watch or no
 * Play Services: syncing to a watch is best-effort and must never surface an error.
 */
class WearSyncModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BirdEchoWearSync")

    AsyncFunction("sendStation") { station: Map<String, Any?>, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      try {
        val request = PutDataMapRequest.create(STATION_PATH).apply {
          for (key in STRING_KEYS) {
            (station[key] as? String)?.let { dataMap.putString(key, it) }
          }
          // Data items are only delivered when they change, so stamp each send.
          dataMap.putLong("sentAt", System.currentTimeMillis())
        }.asPutDataRequest().setUrgent()

        Wearable.getDataClient(context).putDataItem(request)
          .addOnSuccessListener { promise.resolve(true) }
          .addOnFailureListener { promise.resolve(false) }
      } catch (_: Exception) {
        promise.resolve(false)
      }
    }

    AsyncFunction("clearStation") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      try {
        val uri = Uri.Builder().scheme("wear").authority("*").path(STATION_PATH).build()
        Wearable.getDataClient(context).deleteDataItems(uri)
          .addOnSuccessListener { promise.resolve(true) }
          .addOnFailureListener { promise.resolve(false) }
      } catch (_: Exception) {
        promise.resolve(false)
      }
    }
  }
}
