package `in`.malabarhotel.adminalerts

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.MediaPlayer
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.os.IBinder
import android.content.Context
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
        private const val CHANNEL_ID = "hotel_malabar_admin_service_v4_silent"
        private const val POLL_MS = 1500L
        private const val NOTIFICATION_ID = 9401
        private const val API = "https://malabarhotel.in"
        const val ACTION_TEST_SOUND = "in.malabarhotel.adminalerts.TEST_SOUND"
    }
    private val executor = Executors.newSingleThreadExecutor()
    private var token = ""
    private var running = true
    private var mediaPlayer: MediaPlayer? = null
    private var pendingIds = emptySet<String>()
    // Orders already seen by the native alert service. Prevents stale responses
    // from re-triggering a sound after an order has been accepted/rejected.
    private val alertedOrderIds = mutableSetOf<String>()
    private var initialized = false
    private val audioManager by lazy { getSystemService(Context.AUDIO_SERVICE) as AudioManager }
    private var audioFocusRequest: AudioFocusRequest? = null
    private var pollStarted = false

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIFICATION_ID, buildServiceNotification("Order alerts are active"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        token = intent?.getStringExtra(EXTRA_TOKEN).orEmpty()
        if (token.isBlank()) { stopSelf(); return START_NOT_STICKY }
        if (executor.isShutdown) return START_STICKY
        if (!pollStarted) {
            pollStarted = true
            executor.execute { pollLoop() }
        }
        if (intent?.action == ACTION_TEST_SOUND) {
            executor.execute { playCustomSound(loop = false) }
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
                            playCustomSound(loop = true)
                        }
                    }
                    updateServiceNotification(if (pendingIds.isEmpty()) "Waiting for new orders" else pendingIds.size.toString() + " order(s) waiting for acceptance")
                } else if (response.code == 401 || response.code == 403) {
                    stopAlertSound()
                    updateServiceNotification("Admin session expired — open the app to sign in again")
                }
            } catch (_: Exception) {}
            Thread.sleep(POLL_MS)
        }
    }

    private fun isPending(status: String) = status == "new" || status == "pending" || status == "pending confirmation" || status == "order placed" || status == "placed"

    private fun refreshAndPlayCustomSound() {
        try {
            stopAlertSound()
            val response = apiGet("/api/admin/sound-settings")
            if (response.code != 200) return

            val audioData = JSONObject(response.body).optString("audioData", "")
            // The native app must use ONLY the uploaded custom sound. Never fall
            // back to an Android notification/default ringtone.
            if (!audioData.startsWith("data:")) return

            val comma = audioData.indexOf(',')
            if (comma <= 0) return
            val bytes = Base64.getDecoder().decode(audioData.substring(comma + 1))
            if (bytes.isEmpty()) return

            val file = File(cacheDir, "hotel-malabar-order-alert")
            FileOutputStream(file).use { it.write(bytes) }

            requestAudioFocus()
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(file.absolutePath)
                isLooping = true
                setVolume(1f, 1f)
                setOnErrorListener { _, _, _ ->
                    stopAlertSound()
                    true
                }
                prepare()
                start()
            }
        } catch (_: Exception) {
            stopAlertSound()
        }
    }

    private fun requestAudioFocus(): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= 26) {
                val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAcceptsDelayedFocusGain(false)
                    .setWillPauseWhenDucked(false)
                    .build()
                audioFocusRequest = request
                audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun abandonAudioFocus() {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
                audioFocusRequest = null
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
        } catch (_: Exception) {}
    }

    private fun stopAlertSound() {
        try { mediaPlayer?.stop() } catch (_: Exception) {}
        try { mediaPlayer?.release() } catch (_: Exception) {}
        mediaPlayer = null
        abandonAudioFocus()
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
            manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Hotel Malabar Admin Service", NotificationManager.IMPORTANCE_MIN).apply {
                description = "Silent background service for Hotel Malabar order alerts."
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
            })
        }
    }

    private fun buildServiceNotification(text: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        return NotificationCompat.Builder(this, CHANNEL_ID).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("HOTEL MALABAR").setContentText(text).setOngoing(true).setSilent(true).setOnlyAlertOnce(true).setCategory(NotificationCompat.CATEGORY_SERVICE).setContentIntent(pendingIntent).build()
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
}    private fun playCustomSound(loop: Boolean) {
        try {
            stopAlertSound()
            val response = apiGet("/api/admin/sound-settings")
            if (response.code != 200) return

            val audioData = JSONObject(response.body).optString("audioData", "").trim()
            if (!audioData.startsWith("data:")) return

            val comma = audioData.indexOf(',')
            if (comma <= 0) return
            val metadata = audioData.substring(0, comma)
            if (!metadata.contains(";base64", ignoreCase = true)) return

            val encoded = audioData.substring(comma + 1).replace("\\s".toRegex(), "")
            val bytes = try {
                Base64.getDecoder().decode(encoded)
            } catch (_: IllegalArgumentException) {
                return
            }
            if (bytes.isEmpty()) return

            val file = File(cacheDir, "hotel-malabar-order-alert-audio")
            FileOutputStream(file).use { it.write(bytes) }

            requestAudioFocus()

            val player = MediaPlayer()
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            player.setDataSource(file.absolutePath)
            player.isLooping = loop
            player.setVolume(1f, 1f)
            player.setOnCompletionListener {
                if (!loop) {
                    try { player.release() } catch (_: Exception) {}
                    if (mediaPlayer === player) mediaPlayer = null
                    abandonAudioFocus()
                }
            }
            player.setOnErrorListener { _, _, _ ->
                if (mediaPlayer === player) mediaPlayer = null
                try { player.release() } catch (_: Exception) {}
                abandonAudioFocus()
                true
            }
            player.prepare()
            mediaPlayer = player
            player.start()
        } catch (_: Exception) {
            stopAlertSound()
        }
    }

    private fun requestAudioFocus(): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= 26) {
                val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAcceptsDelayedFocusGain(false)
                    .setWillPauseWhenDucked(false)
                    .build()
                audioFocusRequest = request
                audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun stopAlertSound() {
        try { mediaPlayer?.stop() } catch (_: Exception) {}
        try { mediaPlayer?.release() } catch (_: Exception) {}
        mediaPlayer = null
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
                audioFocusRequest = null
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
        } catch (_: Exception) {}
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
            manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Hotel Malabar Admin Service", NotificationManager.IMPORTANCE_MIN).apply {
                description = "Silent background service for Hotel Malabar order alerts."
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
            })
        }
    }

    private fun buildServiceNotification(text: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        return NotificationCompat.Builder(this, CHANNEL_ID).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("HOTEL MALABAR").setContentText(text).setOngoing(true).setSilent(true).setOnlyAlertOnce(true).setCategory(NotificationCompat.CATEGORY_SERVICE).setContentIntent(pendingIntent).build()
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
