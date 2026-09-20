package `in`.malabarhotel.adminalerts

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.MediaPlayer
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Base64
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

class OrderAlertService : Service() {
    companion object {
        const val EXTRA_TOKEN = "token"
        private const val CHANNEL_ID = "hotel_malabar_admin_service"
        private const val NOTIFICATION_ID = 9401
        private const val API = "https://malabarhotel.in"
    }
    private val executor = Executors.newSingleThreadExecutor()
    private var token = ""
    private var running = true
    private var mediaPlayer: MediaPlayer? = null
    private var pendingIds = emptySet<String>()
    private var initialized = false

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIFICATION_ID, buildServiceNotification("Order alerts are active"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        token = intent?.getStringExtra(EXTRA_TOKEN).orEmpty()
        if (token.isBlank()) { stopSelf(); return START_NOT_STICKY }
        if (executor.isShutdown) return START_STICKY
        executor.execute { pollLoop() }
        return START_STICKY
    }

    private fun pollLoop() {
        while (running) {
            try {
                val response = apiGet("/api/admin/orders")
                if (response.code == 200) {
                    val json = JSONArray(response.body)
                    val currentPending = mutableSetOf<String>()
                    for (i in 0 until json.length()) {
                        val order = json.getJSONObject(i)
                        val id = order.optString("id")
                        val status = order.optString("status").trim().lowercase()
                        if (id.isNotBlank() && isPending(status)) currentPending.add(id)
                    }
                    pendingIds = currentPending
                    if (pendingIds.isEmpty()) {
                        stopAlertSound()
                    } else if (mediaPlayer == null) {
                        vibrate()
                        refreshAndPlayCustomSound()
                    }
                    updateServiceNotification(if (pendingIds.isEmpty()) "Waiting for new orders" else pendingIds.size.toString() + " order(s) waiting for acceptance")
                } else if (response.code == 401 || response.code == 403) {
                    stopAlertSound()
                    updateServiceNotification("Admin session expired — open the app to sign in again")
                }
            } catch (_: Exception) {}
            Thread.sleep(3000)
        }
    }

    private fun isPending(status: String) = status == "new" || status == "pending" || status == "pending confirmation" || status == "order placed" || status == "placed"

    private fun refreshAndPlayCustomSound() {
        try {
            val response = apiGet("/api/admin/sound-settings")
            val audioData = JSONObject(response.body).optString("audioData", "")
            stopAlertSound()
            if (audioData.startsWith("data:")) {
                val comma = audioData.indexOf(',')
                if (comma > 0) {
                    val bytes = Base64.getDecoder().decode(audioData.substring(comma + 1))
                    val file = File(cacheDir, "hotel-malabar-order-alert")
                    FileOutputStream(file).use { it.write(bytes) }
                    mediaPlayer = MediaPlayer().apply {
                        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                        setDataSource(file.absolutePath)
                        isLooping = true
                        setVolume(1f, 1f)
                        prepare()
                        start()
                    }
                    return
                }
            }
            val mp = MediaPlayer().apply {
                setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                setDataSource(this@OrderAlertService, android.provider.Settings.System.DEFAULT_NOTIFICATION_URI)
                isLooping = true
                prepare()
                start()
            }
            mediaPlayer = mp
        } catch (_: Exception) { stopAlertSound() }
    }

    private fun stopAlertSound() {
        try { mediaPlayer?.stop() } catch (_: Exception) {}
        try { mediaPlayer?.release() } catch (_: Exception) {}
        mediaPlayer = null
    }

    private fun vibrate() {
        try {
            val pattern = longArrayOf(0, 300, 150, 300, 150, 600)
            if (Build.VERSION.SDK_INT >= 31) {
                (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                (getSystemService(VIBRATOR_SERVICE) as Vibrator).vibrate(VibrationEffect.createWaveform(pattern, -1))
            }
        } catch (_: Exception) {}
    }

    private data class ApiResponse(val code: Int, val body: String)

    private fun apiGet(path: String): ApiResponse {
        val conn = URL(API + path).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connectTimeout = 12000
        conn.readTimeout = 12000
        conn.setRequestProperty("Authorization", "Bearer " + token)
        conn.setRequestProperty("Cache-Control", "no-cache")
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
        conn.disconnect()
        return ApiResponse(code, body)
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Hotel Malabar Admin Service", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Keeps the admin order alert service active."
                setSound(null, null)
            })
        }
    }

    private fun buildServiceNotification(text: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        return NotificationCompat.Builder(this, CHANNEL_ID).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("HOTEL MALABAR").setContentText(text).setOngoing(true).setCategory(NotificationCompat.CATEGORY_SERVICE).setContentIntent(pendingIntent).build()
    }

    private fun updateServiceNotification(text: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildServiceNotification(text))
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        try {
            val restart = Intent(applicationContext, OrderAlertService::class.java).putExtra(EXTRA_TOKEN, token)
            androidx.core.content.ContextCompat.startForegroundService(applicationContext, restart)
        } catch (_: Exception) {}
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        running = false
        stopAlertSound()
        executor.shutdownNow()
        super.onDestroy()
    }
    override fun onBind(intent: Intent?): IBinder? = null
}
