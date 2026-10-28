package dev.arunrajiah.birdecho.basewifi

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Joins a Wildlife Network Base's hotspot without making it the phone's default network.
 *
 * Android 10+ shows its own "connect to device" dialog for a WifiNetworkSpecifier request; the hotspot has no
 * internet, so the request drops NET_CAPABILITY_INTERNET. bind() routes the whole app through the Base (needed
 * because React Native's fetch uses the process default network); unbind() returns to normal routing so calls to
 * Wildlife Network go over mobile data. Older Android versions resolve "unsupported" and the user joins by hand.
 */
class BaseWifiModule : Module() {
  private var callback: ConnectivityManager.NetworkCallback? = null
  private var network: Network? = null

  private fun cm(): ConnectivityManager? =
    appContext.reactContext?.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager

  private fun release() {
    val c = cm()
    c?.bindProcessToNetwork(null)
    callback?.let { try { c?.unregisterNetworkCallback(it) } catch (_: Exception) {} }
    callback = null
    network = null
  }

  override fun definition() = ModuleDefinition {
    Name("BirdEchoBaseWifi")

    Function("isSupported") { Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q }

    /** Resolves "connected", "unavailable" (no such network, or the user declined) or "unsupported". */
    AsyncFunction("connect") { ssid: String, passphrase: String, timeoutMs: Int, promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        promise.resolve("unsupported")
        return@AsyncFunction
      }
      val c = cm()
      if (c == null) {
        promise.resolve("unavailable")
        return@AsyncFunction
      }
      release()
      val specifier = WifiNetworkSpecifier.Builder().setSsid(ssid).setWpa2Passphrase(passphrase).build()
      val request = NetworkRequest.Builder()
        .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
        .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        .setNetworkSpecifier(specifier)
        .build()
      var settled = false
      val cb = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(n: Network) {
          network = n
          if (!settled) { settled = true; promise.resolve("connected") }
        }
        override fun onUnavailable() {
          if (!settled) { settled = true; promise.resolve("unavailable") }
        }
        override fun onLost(n: Network) {
          if (network == n) { network = null; c.bindProcessToNetwork(null) }
        }
      }
      callback = cb
      try {
        c.requestNetwork(request, cb, timeoutMs.coerceIn(5_000, 120_000))
      } catch (_: Exception) {
        if (!settled) { settled = true; promise.resolve("unavailable") }
      }
    }

    /** Route the app's requests through the Base's network. False when not connected. */
    Function("bind") { -> val n = network; n != null && (cm()?.bindProcessToNetwork(n) == true) }

    /** Back to normal routing (mobile data or home Wi-Fi). */
    Function("unbind") { -> cm()?.bindProcessToNetwork(null); true }

    /** Leave the Base's hotspot. */
    Function("disconnect") { -> release(); true }

    OnDestroy { release() }
  }
}
