package `in`.malabarhotel.adminalerts

import android.Manifest
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
    private val secureAlias = "HotelMalabarAdminKey"

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
                if (url.startsWith(BASE_URL)) {
                    view.evaluateJavascript("document.body.classList.add('native-admin-mobile');", null)
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

    override fun onBackPressed() {
        if (webView.visibility == android.view.View.VISIBLE && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
