package dev.arunrajiah.birdecho.wear

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.sp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

private const val RESOURCES_VERSION = "1"
private const val GREEN = 0xFF4ADE80.toInt()
private const val WHITE = 0xFFFFFFFF.toInt()
private const val GREY = 0xFFB0B0B0.toInt()

/**
 * Renders from the cache only; RefreshWorker does the network work and asks for
 * a redraw. That keeps tile rendering instant and within the system's deadline.
 */
class GlanceTileService : TileService() {

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        val store = Store(this)
        val station = store.station
        if (station != null && station.isSupported) {
            RefreshWorker.schedule(this)
            RefreshWorker.refreshNow(this)
        }

        val tile = TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setFreshnessIntervalMillis(15 * 60 * 1000L)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout(station, store.glance)))
            .build()
        return Futures.immediateFuture(tile)
    }

    override fun onTileResourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest,
    ): ListenableFuture<ResourceBuilders.Resources> =
        Futures.immediateFuture(ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build())

    private fun layout(station: StationConfig?, glance: Glance?): LayoutElementBuilders.LayoutElement {
        val column = LayoutElementBuilders.Column.Builder()
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)

        when {
            station == null -> {
                column.addContent(text(getString(R.string.setup_title), 16f, WHITE, bold = true))
                column.addContent(spacer(6f))
                column.addContent(text(getString(R.string.setup_body), 12f, GREY, maxLines = 4))
            }
            !station.isSupported -> {
                column.addContent(text(station.stationName, 12f, GREEN, bold = true))
                column.addContent(spacer(6f))
                column.addContent(text(getString(R.string.unsupported_body), 12f, GREY, maxLines = 5))
            }
            else -> {
                if (station.stationName.isNotBlank()) {
                    column.addContent(text(station.stationName, 12f, GREEN, bold = true))
                    column.addContent(spacer(6f))
                }
                column.addContent(
                    text(glance?.lastSpecies ?: getString(R.string.no_detections), 18f, WHITE, bold = true, maxLines = 2),
                )
                glance?.lastTime?.let {
                    column.addContent(spacer(2f))
                    column.addContent(text(it, 13f, GREY))
                }
                if (glance != null) {
                    column.addContent(spacer(8f))
                    column.addContent(text(todayLabel(glance), 13f, WHITE))
                }
            }
        }

        val openApp = ModifiersBuilders.Clickable.Builder()
            .setId("open")
            .setOnClick(
                ActionBuilders.LaunchAction.Builder()
                    .setAndroidActivity(
                        ActionBuilders.AndroidActivity.Builder()
                            .setPackageName(packageName)
                            .setClassName(MainActivity::class.java.name)
                            .build(),
                    )
                    .build(),
            )
            .build()

        return LayoutElementBuilders.Box.Builder()
            .setWidth(expand())
            .setHeight(expand())
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setClickable(openApp)
                    .setPadding(ModifiersBuilders.Padding.Builder().setAll(dp(24f)).build())
                    .build(),
            )
            .addContent(column.build())
            .build()
    }

    private fun todayLabel(glance: Glance): String = when {
        glance.todayCapped -> getString(R.string.today_capped, glance.todayCount)
        glance.todayCount == 1 -> getString(R.string.today_one)
        else -> getString(R.string.today_many, glance.todayCount)
    }

    private fun text(
        value: String,
        size: Float,
        color: Int,
        bold: Boolean = false,
        maxLines: Int = 1,
    ): LayoutElementBuilders.LayoutElement =
        LayoutElementBuilders.Text.Builder()
            .setText(value)
            .setMaxLines(maxLines)
            .setMultilineAlignment(LayoutElementBuilders.TEXT_ALIGN_CENTER)
            .setOverflow(LayoutElementBuilders.TEXT_OVERFLOW_ELLIPSIZE_END)
            .setFontStyle(
                LayoutElementBuilders.FontStyle.Builder()
                    .setSize(sp(size))
                    .setColor(argb(color))
                    .setWeight(
                        if (bold) LayoutElementBuilders.FONT_WEIGHT_BOLD else LayoutElementBuilders.FONT_WEIGHT_NORMAL,
                    )
                    .build(),
            )
            .build()

    private fun spacer(height: Float): LayoutElementBuilders.LayoutElement =
        LayoutElementBuilders.Spacer.Builder().setHeight(dp(height)).build()
}
