package dev.arunrajiah.birdecho.wear

import android.content.Context
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataItem
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService

/** Path and keys must match modules/wear-sync on the phone side. */
const val STATION_PATH = "/birdecho/station"

fun applyStationItem(context: Context, item: DataItem) {
    val map = DataMapItem.fromDataItem(item).dataMap
    val type = map.getString("connectionType") ?: return
    Store(context).station = StationConfig(
        connectionType = type,
        stationName = map.getString("stationName") ?: "",
        bwStationId = map.getString("bwStationId"),
        token = map.getString("token"),
        hostUrl = map.getString("hostUrl"),
    )
    RefreshWorker.schedule(context)
    RefreshWorker.refreshNow(context)
}

class ConfigListenerService : WearableListenerService() {
    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.dataItem.uri.path != STATION_PATH) continue
            when (event.type) {
                DataEvent.TYPE_CHANGED -> applyStationItem(applicationContext, event.dataItem)
                DataEvent.TYPE_DELETED -> Store(applicationContext).station = null
            }
        }
    }
}
