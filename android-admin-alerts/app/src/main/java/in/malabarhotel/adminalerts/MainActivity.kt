package `in`.malabarhotel.adminalerts

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import android.os.Build
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.io.OutputStream

class MainActivity : Activity() {
    companion object {
        const val BASE_URL = "https://malabarhotel.in"
        const val PREFS = "hotel_malabar_admin"
        const val TOKEN = "admin_token"
        const val BATTERY_SETUP = "battery_setup_done"
    }
    private lateinit var loginPanel: LinearLayout
    private lateinit var webView: WebView
    private lateinit var statusText: TextView
    private var tokenInjected = false
    private val secureAlias = "HotelMalabarAdminKey"
    private val kotPrinterMac = "66:22:7B:91:DF:B2"
    private val sppUuid = java.util.UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        loginPanel = findViewById(R.id.loginPanel)
        webView = findViewById(R.id.adminWebView)
        statusText = findViewById(R.id.statusText)

        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 501)
        }

        findViewById<Button>(R.id.loginButton).setOnClickListener {
            login(findViewById<EditText>(R.id.phoneInput).text.toString().trim(), findViewById<EditText>(R.id.passwordInput).text.toString())
        }
        val savedToken = getSharedPreferences(PREFS, MODE_PRIVATE).getString(TOKEN, null)
        if (!savedToken.isNullOrBlank() && !isJwtExpired(savedToken)) {
            requestAlertPermissionsIfNeeded()
            openAdmin(savedToken)
        } else {
            silentLoginIfCredentialsSaved()
        }
    }

    private fun login(phone: String, password: String) {
        if (phone.isBlank() || password.isBlank()) {
            statusText.text = "Enter admin phone number and password."
            return
        }
        statusText.text = "Signing in…"
        Thread {
            try {
                val conn = URL(BASE_URL + "/api/admin/login").openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                OutputStreamWriter(conn.outputStream).use { it.write(JSONObject().apply { put("phone", phone); put("password", password) }.toString()) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = BufferedReader(InputStreamReader(stream)).use { it.readText() }
                val json = JSONObject(body)
                if (conn.responseCode !in 200..299) throw Exception(json.optString("error", "Admin login failed."))
                val token = json.getString("token")
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(TOKEN, token).apply()
                saveSecure("phone", phone)
                saveSecure("password", password)
                runOnUiThread { requestAlertPermissionsIfNeeded(); openAdmin(token) }
            } catch (e: Exception) {
                runOnUiThread { statusText.text = e.message ?: "Login failed." }
            }
        }.start()
    }

    private fun silentLoginIfCredentialsSaved() {
        val phone = readSecure("phone")
        val password = readSecure("password")
        if (phone.isNullOrBlank() || password.isNullOrBlank()) {
            loginPanel.visibility = android.view.View.VISIBLE
            webView.visibility = android.view.View.GONE
            return
        }
        statusText.text = "Restoring secure admin session…"
        Thread {
            try {
                val conn = URL(BASE_URL + "/api/admin/login").openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.connectTimeout = 15000
                conn.readTimeout = 15000
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                OutputStreamWriter(conn.outputStream).use { it.write(JSONObject().apply { put("phone", phone); put("password", password) }.toString()) }
                val body = BufferedReader(InputStreamReader(if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream)).use { it.readText() }
                if (conn.responseCode !in 200..299) throw Exception("Session expired")
                val token = JSONObject(body).getString("token")
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(TOKEN, token).apply()
                runOnUiThread { requestAlertPermissionsIfNeeded(); openAdmin(token) }
            } catch (_: Exception) {
                runOnUiThread {
                    statusText.text = "Please sign in again."
                    loginPanel.visibility = android.view.View.VISIBLE
                    webView.visibility = android.view.View.GONE
                }
            }
        }.start()
    }

    private fun isJwtExpired(token: String): Boolean {
        return try {
            val parts = token.split(".")
            if (parts.size != 3) return true
            val payload = String(Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING), StandardCharsets.UTF_8)
            val exp = JSONObject(payload).optLong("exp", 0L)
            exp <= (System.currentTimeMillis() / 1000L) + 30L
        } catch (_: Exception) { true }
    }

    private fun getOrCreateSecretKey(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = ks.getKey(secureAlias, null)
        if (existing is SecretKey) return existing
        val generator = KeyGenerator.getInstance("AES", "AndroidKeyStore")
        generator.init(android.security.keystore.KeyGenParameterSpec.Builder(secureAlias, android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT).setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE).build())
        return generator.generateKey()
    }

    private fun saveSecure(name: String, value: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
        val encrypted = cipher.iv + cipher.doFinal(value.toByteArray(StandardCharsets.UTF_8))
        val encoded = Base64.encodeToString(encrypted, Base64.NO_WRAP)
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("secure_$name", encoded).apply()
    }

    private fun readSecure(name: String): String? {
        return try {
            val encoded = getSharedPreferences(PREFS, MODE_PRIVATE).getString("secure_$name", null) ?: return null
            val bytes = Base64.decode(encoded, Base64.NO_WRAP)
            val iv = bytes.copyOfRange(0, 12)
            val ciphertext = bytes.copyOfRange(12, bytes.size)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateSecretKey(), GCMParameterSpec(128, iv))
            String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8)
        } catch (_: Exception) { null }
    }
    private fun requestAlertPermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 501)
        }
        if (Build.VERSION.SDK_INT >= 23) {
            val pm = getSystemService(POWER_SERVICE) as android.os.PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (_: Exception) {
                    try { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) } catch (_: Exception) {}
                }
            }
        }
    }
    private fun openAdmin(token: String) {
        loginPanel.visibility = android.view.View.GONE
        webView.visibility = android.view.View.VISIBLE
        webView.settings.javaScriptEnabled = true
        webView.addJavascriptInterface(NativePrinterBridge(), "AndroidPrinter")
        webView.settings.domStorageEnabled = true
        // Keep the admin site in a normal responsive tablet/mobile viewport.
        webView.settings.useWideViewPort = true
        webView.settings.loadWithOverviewMode = false
        webView.settings.setSupportZoom(false)
        webView.settings.textZoom = 100
        webView.setInitialScale(0)
        webView.settings.mediaPlaybackRequiresUserGesture = false
        CookieManager.getInstance().setAcceptCookie(true)
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                if (url.startsWith(BASE_URL)) {
                    view.evaluateJavascript("""
                        (function(){
                          document.documentElement.classList.add('native-admin-mobile'); document.body.classList.add('native-admin-mobile');
                          var m=document.querySelector('meta[name="viewport"]');
                          if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}
                          m.setAttribute('content','width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
                          var s=document.getElementById('native-admin-direct-css');
                          if(!s){
                            s=document.createElement('style');
                            s.id='native-admin-direct-css';
                            s.textContent=''' 
                              .native-admin-mobile .admin-page-shell{width:100%!important;min-width:0!important;overflow-x:hidden!important}
                              .native-admin-mobile .admin-page-shell>div.flex-1.flex.max-w-7xl.w-full.mx-auto{display:block!important;width:100%!important;max-width:none!important;margin:0!important}
                              .native-admin-mobile .admin-page-shell header>div:first-child>div:last-child{display:none!important}
                              .native-admin-mobile .admin-page-shell header>div:nth-child(2){display:none!important}
                              .native-admin-mobile .admin-page-shell header button[aria-label="Toggle Admin Menu Sidebar"]{display:flex!important}
                              .native-admin-mobile .admin-page-shell aside{display:flex!important;position:fixed!important;top:78px!important;left:0!important;width:min(88vw,360px)!important;height:calc(100vh - 78px)!important;z-index:120!important;transform:translateX(-110%)!important}
                              .native-admin-mobile .admin-page-shell aside.translate-x-0,.native-admin-mobile .admin-page-shell aside.lg\\:translate-x-0{transform:translateX(0)!important}
                              .native-admin-mobile .admin-page-shell main{display:block!important;width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:16px 12px 28px!important;overflow-x:hidden!important}
                              .native-admin-mobile .admin-page-shell main .grid[class*="lg:grid-cols-2"]{grid-template-columns:minmax(0,1fr)!important}
                              .native-admin-mobile .admin-page-shell main input,.native-admin-mobile .admin-page-shell main select,.native-admin-mobile .admin-page-shell main textarea{min-height:42px!important;font-size:14px!important}
                              .native-admin-mobile .admin-page-shell main button{min-height:40px!important}
                            ''';
                            document.head.appendChild(s);
                          }
                        })();
                    """.trimIndent(), null)
                    if (!tokenInjected) {
                        tokenInjected = true
                        val escaped = JSONObject.quote(token)
                        view.evaluateJavascript("(function(){localStorage.setItem('hm_admin_token'," + escaped + "); location.reload();})()", null)
                    }
                }
            }
        }
        ContextCompat.startForegroundService(this, Intent(this, OrderAlertService::class.java).putExtra(OrderAlertService.EXTRA_TOKEN, token))
        webView.loadUrl(BASE_URL + "/admin")
    }

    private inner class NativePrinterBridge {
        @JavascriptInterface
        fun isAvailable(): Boolean = try {
            val adapter = BluetoothAdapter.getDefaultAdapter() ?: return false
            adapter.isEnabled && if (Build.VERSION.SDK_INT >= 31) ActivityCompat.checkSelfPermission(this@MainActivity, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED else true
        } catch (_: Exception) { false }

        @JavascriptInterface
        fun printKOT(orderJson: String, type: String, paperWidth: String) {
            Thread {
                try {
                    if (Build.VERSION.SDK_INT >= 31 && ActivityCompat.checkSelfPermission(this@MainActivity, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                        runOnUiThread { ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.BLUETOOTH_CONNECT), 701) }
                        throw Exception("Bluetooth permission is required.")
                    }
                    val order = JSONObject(orderJson)
                    val adapter = BluetoothAdapter.getDefaultAdapter() ?: throw Exception("Bluetooth is not available on this device.")
                    if (!adapter.isEnabled) throw Exception("Please turn on Bluetooth.")
                    val device = adapter.getRemoteDevice(kotPrinterMac)
                    val socket = device.createRfcommSocketToServiceRecord(sppUuid)
                    adapter.cancelDiscovery()
                    socket.connect()
                    socket.outputStream.use { out ->
                        writeEscPos(out, order, type, paperWidth)
                        out.flush()
                    }
                    socket.close()
                    runOnUiThread { android.widget.Toast.makeText(this@MainActivity, "KOT sent to RPD-588", android.widget.Toast.LENGTH_SHORT).show() }
                } catch (e: Exception) {
                    runOnUiThread { android.widget.Toast.makeText(this@MainActivity, "Printer error: ${e.message ?: "Could not print"}", android.widget.Toast.LENGTH_LONG).show() }
                }
            }.start()
        }
    }

    private fun writeEscPos(out: OutputStream, o: JSONObject, type: String, paperWidth: String) {
        fun text(s: String) { out.write(s.toByteArray(Charsets.UTF_8)) }
        fun line() { text("\n") }
        fun bold(on: Boolean) { out.write(byteArrayOf(0x1B, 0x45, if (on) 1 else 0)) }
        fun center() { out.write(byteArrayOf(0x1B, 0x61, 1)) }
        fun left() { out.write(byteArrayOf(0x1B, 0x61, 0)) }
        fun cut() { out.write(byteArrayOf(0x1D, 0x56, 0x42, 0x00)) }

        out.write(byteArrayOf(0x1B, 0x40))
        center(); bold(true); text("HOTEL MALABAR"); line(); bold(false)
        text("AUTHENTIC KERALA CUISINE"); line()
        text("Sulthan Bathery, Wayanad"); line()
        text("9567562071 / 8904634717"); line()
        bold(true); text(if (type == "KOT") "*** KITCHEN ORDER TICKET ***" else "*** CUSTOMER BILL ***"); line(); bold(false)
        text("--------------------------------"); line()
        left(); bold(true); text("ORDER: " + o.optString("orderNumber")); line(); bold(false)
        text("DATE: " + java.text.SimpleDateFormat("dd-MMM-yyyy hh:mm a", java.util.Locale.ENGLISH).format(java.util.Date(o.optString("createdAt").toLongOrNull() ?: System.currentTimeMillis()))); line()
        text("CUSTOMER: " + o.optString("customerName")); line()
        text("PHONE: " + o.optString("customerPhone")); line()
        text("AREA: " + o.optString("deliveryArea")); line()
        text("ADDRESS: " + o.optString("deliveryAddress")); line()
        val special = o.optString("specialInstructions").trim()
        text("SPECIAL: " + if (special.isBlank()) "None" else special); line()
        text("--------------------------------"); line()
        val items = o.optJSONArray("items") ?: JSONArray()
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            bold(true); text(item.optInt("quantity", 1).toString() + "x " + item.optString("itemName")); bold(false)
            text("  Rs." + item.optString("subtotal")); line()
        }
        text("--------------------------------"); line()
        text("FOOD TOTAL: Rs." + o.optString("foodTotal")); line()
        text("DELIVERY:   Rs." + o.optString("deliveryCharge")); line()
        bold(true); text("GRAND TOTAL: Rs." + o.optString("grandTotal")); line(); bold(false)
        text("PAYMENT: CASH ON DELIVERY"); line()
        center(); line(); bold(true); text(if (type == "KOT") "PREPARE FRESH & DELIVER QUICKLY" else "THANK YOU"); line(); bold(false)
        line(); line(); line(); cut()
    }

    override fun onBackPressed() {
        if (webView.visibility == android.view.View.VISIBLE && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
