package `in`.malabarhotel.adminalerts

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.MediaPlayer
import android.media.AudioAttributes
import android.media.AudioManager
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
import android.content.pm.ServiceInfo

class OrderAlertService : Service() {
    companion object {
        const val EXTRA_TOKEN = "token"
        private const val CHANNEL_ID = "hotel_malabar_admin_service_v3_silent"
        private const val NOTIFICATION_ID = 9401
        private const val API = "https://malabarhotel.in"
    }
    private val executor = Executors.newSingleThreadExecutor()
    private var token = ""
    private var running = true
    private var mediaPlayer: MediaPlayer? = null
    private var pendingIds = emptySet<String>()
    // Prevent a delayed/stale API response from re-alerting an order that was already handled.
    private val alertedOrderIds = mutableSetOf<String>()
    private var initialized = false
    private var pollStarted = false
    private var lastServiceText = ""
    private var audioManager: AudioManager? = null
    private var audioFocusGranted = false

    override fun onCreate() {
        super.onCreate()
        createChannel()
        audioManager = getSystemService(AudioManager::class.java)
        startForegroundCompat(buildServiceNotification("Order alerts are active"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        token = intent?.getStringExtra(EXTRA_TOKEN).orEmpty()
        if (token.isBlank()) { stopSelf(); return START_NOT_STICKY }
        if (executor.isShutdown) return START_STICKY
        if (!pollStarted) {
            pollStarted = true
            executor.execute { pollLoop() }
        }
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
                    val previousPending = pendingIds
                    pendingIds = currentPending

                    // Existing orders are only the initial baseline. Never alert for an
                    // already-pending order when the service/app starts.
                    if (!initialized) {
                        initialized = true
                        // Existing pending orders are only the startup baseline.
                        alertedOrderIds.addAll(pendingIds)
                        stopAlertSound()
                    } else if (pendingIds.isEmpty()) {
                        // All pending orders have been accepted/rejected.
                        stopAlertSound()
                    } else {
                        val newlyArrived = (pendingIds - previousPending) - alertedOrderIds
                        if (newlyArrived.isNotEmpty() && mediaPlayer == null) {
                            alertedOrderIds.addAll(newlyArrived)
                            vibrate()
                            refreshAndPlayCustomSound()
                        }
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
            requestAudioFocus()
            val response = apiGet("/api/admin/sound-settings")
            val audioData = if (response.code == 200) JSONObject(response.body).optString("audioData", "") else ""
            stopAlertSound()
            if (audioData.startsWith("data:")) {
                val comma = audioData.indexOf(',')
                if (comma > 0) {
                    val header = audioData.substring(0, comma)
                    val payload = audioData.substring(comma + 1)
                    val bytes = if (header.contains(";base64", ignoreCase = true)) {
                        Base64.getDecoder().decode(payload)
                    } else {
                        java.net.URLDecoder.decode(payload, "UTF-8").toByteArray(Charsets.UTF_8)
                    }
                    val file = File(cacheDir, "hotel-malabar-order-alert")
                    FileOutputStream(file).use { it.write(bytes) }
                    mediaPlayer = MediaPlayer().apply {
                        setAudioAttributes(
                            AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ALARM)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .build()
                        )
                        setDataSource(file.absolutePath)
                        isLooping = true
                        setVolume(1f, 1f)
                        prepare()
                        start()
                    }
                    updateServiceNotification("NEW ORDER - alert sound active")
                    return
                }
            }
            val uri = (android.provider.RingtoneManager.getDefaultUri(android.provider.RingtoneManager.TYPE_ALARM)
                ?: android.provider.RingtoneManager.getDefaultUri(android.provider.RingtoneManager.TYPE_NOTIFICATION))
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@OrderAlertService, uri)
                isLooping = true
                setVolume(1f, 1f)
                prepare()
                start()
            }
            updateServiceNotification("NEW ORDER - default alert sound active")
        } catch (_: Exception) {
            stopAlertSound()
            try {
                val uri = (android.provider.RingtoneManager.getDefaultUri(android.provider.RingtoneManager.TYPE_ALARM)
                ?: android.provider.RingtoneManager.getDefaultUri(android.provider.RingtoneManager.TYPE_NOTIFICATION))
                mediaPlayer = MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    setDataSource(this@OrderAlertService, uri)
                    isLooping = true
                    prepare()
                    start()
                }
            } catch (_: Exception) {}
        }
    }

    private fun stopAlertSound() {
        try { mediaPlayer?.stop() } catch (_: Exception) {}
        try { mediaPlayer?.release() } catch (_: Exception) {}
        mediaPlayer = null
        abandonAudioFocus()
    }

    private fun requestAudioFocus() {
        try {
            val manager = audioManager ?: return
            if (Build.VERSION.SDK_INT >= 26) {
                val request = android.media.AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAcceptsDelayedFocusGain(false)
                    .build()
                audioFocusGranted = manager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            } else {
                @Suppress("DEPRECATION")
                audioFocusGranted = manager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            }
        } catch (_: Exception) {}
    }

    private fun abandonAudioFocus() {
        try {
            if (!audioFocusGranted) return
            if (Build.VERSION.SDK_INT < 26) {
                @Suppress("DEPRECATION")
                audioManager?.abandonAudioFocus(null)
            }
            audioFocusGranted = false
        } catch (_: Exception) {}
    }

    private fun startForegroundCompat(notification: Notification) {
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
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
                enableVibration(false)
            })
        }
    }

    private fun buildServiceNotification(text: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("HOTEL MALABAR")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun updateServiceNotification(text: String) {
        if (text == lastServiceText) return
        lastServiceText = text
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
