package dev.arunrajiah.birdecho.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.Text
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

private val Green = Color(0xFF4ADE80)
private val Grey = Color(0xFFB0B0B0)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                AppScaffold {
                    ScreenScaffold {
                        GlanceScreen()
                    }
                }
            }
        }
    }
}

@Composable
private fun GlanceScreen() {
    val context = LocalContext.current.applicationContext
    val store = remember { Store(context) }
    val scope = rememberCoroutineScope()

    var station by remember { mutableStateOf(store.station) }
    var glance by remember { mutableStateOf(store.glance) }
    var refreshing by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }

    suspend fun refresh() {
        refreshing = true
        failed = !refreshGlance(context)
        glance = store.glance
        refreshing = false
    }

    LaunchedEffect(Unit) {
        // The listener service only fires on changes, so a watch app installed
        // after the phone sent the station has to read the stored item itself.
        if (station == null) {
            try {
                val items = Wearable.getDataClient(context).dataItems.await()
                try {
                    items.firstOrNull { it.uri.path == STATION_PATH }?.let { applyStationItem(context, it) }
                } finally {
                    items.release()
                }
                station = store.station
            } catch (_: Exception) {
                // No Play Services connection or no paired phone: stay on the setup screen.
            }
        }
        if (station?.isSupported == true) {
            RefreshWorker.schedule(context)
            refresh()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        val current = station
        when {
            current == null -> {
                Text(stringResource(R.string.setup_title), fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Spacer(Modifier.height(6.dp))
                Text(stringResource(R.string.setup_body), color = Grey, fontSize = 12.sp, textAlign = TextAlign.Center)
            }
            !current.isSupported -> {
                Text(current.stationName, color = Green, fontSize = 12.sp, textAlign = TextAlign.Center)
                Spacer(Modifier.height(6.dp))
                Text(stringResource(R.string.unsupported_body), color = Grey, fontSize = 12.sp, textAlign = TextAlign.Center)
            }
            else -> {
                val g = glance
                if (current.stationName.isNotBlank()) {
                    Text(current.stationName, color = Green, fontSize = 12.sp, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(6.dp))
                }
                Text(
                    g?.lastSpecies ?: stringResource(R.string.no_detections),
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center,
                )
                g?.lastTime?.let { Text(it, color = Grey, fontSize = 13.sp) }
                if (g != null) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        when {
                            g.todayCapped -> stringResource(R.string.today_capped, g.todayCount)
                            g.todayCount == 1 -> stringResource(R.string.today_one)
                            else -> stringResource(R.string.today_many, g.todayCount)
                        },
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                    )
                }
                if (failed) {
                    Spacer(Modifier.height(6.dp))
                    Text(stringResource(R.string.offline), color = Grey, fontSize = 11.sp, textAlign = TextAlign.Center)
                }
                Spacer(Modifier.height(10.dp))
                Button(onClick = { scope.launch { refresh() } }, enabled = !refreshing) {
                    Text(stringResource(if (refreshing) R.string.refreshing else R.string.refresh))
                }
            }
        }
    }
}
