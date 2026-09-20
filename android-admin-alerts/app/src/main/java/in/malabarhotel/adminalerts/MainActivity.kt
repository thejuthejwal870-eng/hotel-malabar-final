package `in`.malabarhotel.adminalerts

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter

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
        if (!savedToken.isNullOrBlank()) { requestAlertPermissionsIfNeeded(); openAdmin(savedToken) }
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
                runOnUiThread { requestAlertPermissionsIfNeeded(); openAdmin(token) }
            } catch (e: Exception) {
                runOnUiThread { statusText.text = e.message ?: "Login failed." }
            }
        }.start()
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
        webView.settings.domStorageEnabled = true
        // Keep the admin site in a normal responsive tablet/mobile viewport.
        webView.settings.useWideViewPort = false
        webView.settings.loadWithOverviewMode = false
        webView.settings.setSupportZoom(false)
        webView.settings.textZoom = 100
        webView.setInitialScale(100)
        webView.settings.mediaPlaybackRequiresUserGesture = false
        CookieManager.getInstance().setAcceptCookie(true)
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                if (!tokenInjected && url.startsWith(BASE_URL)) {
                    tokenInjected = true
                    val escaped = JSONObject.quote(token)
                    view.evaluateJavascript("(function(){localStorage.setItem('hm_admin_token'," + escaped + "); location.reload();})()", null)
                }
            }
        }
        ContextCompat.startForegroundService(this, Intent(this, OrderAlertService::class.java).putExtra(OrderAlertService.EXTRA_TOKEN, token))
        webView.loadUrl(BASE_URL + "/admin")
    }

    override fun onBackPressed() {
        if (webView.visibility == android.view.View.VISIBLE && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
