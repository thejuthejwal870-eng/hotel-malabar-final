package `in`.malabarhotel.adminalerts

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder
import java.util.Base64
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

class OrderAlertService : Service() {
    companion object {
        const val EXTRA_TOKEN = "token"
        private const val CHANNEL_ID = "hotel_malabar_admin_service_v5_silent"
        private const val POLL_MS = 2000L
        private const val NOTIFICATION_ID = 9401
        private const val API = "https://malabarhotel.in"
        const val ACTION_TEST_SOUND = "in.malabarhotel.adminalerts.TEST_SOUND"
    }

    private val executor = Executors.newSingleThreadExecutor()
    private var token = ""
    @Volatile private var running = true
    private var mediaPlayer: MediaPlayer? = null
    private var pendingIds = emptySet<String>()
    private val alertedOrderIds = mutableSetOf<String>()
    private var initialized = false
    private var audioFocusGranted = false
    private var audioFocusRequest: android.media.AudioFocusRequest? = null
    @Volatile private var pollStarted = false
    @Volatile private var testPlayback = false

    private val audioManager by lazy {
        getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIFICATION_ID, buildServiceNotification("Order alerts are active"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        token = intent?.getStringExtra(EXTRA_TOKEN).orEmpty()
        if (token.isBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (!executor.isShutdown) {
            if (!pollStarted) {
                pollStarted = true
                executor.execute { pollLoop() }
            }
            if (intent?.action == ACTION_TEST_SOUND) {
                Thread { refreshAndPlayCustomSound(loop = false) }.start()
            }
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

                    if (!initialized) {
                        initialized = true
                        alertedOrderIds.addAll(pendingIds)
                        if (!testPlayback) stopAlertSound()
                    } else if (pendingIds.isEmpty()) {
                        // No unaccepted orders remain. This is the hard stop condition:
                        // accepted/rejected orders must silence the custom sound immediately.
                        testPlayback = false
                        stopAlertSound()
                    } else {
                        val newlyArrived = (pendingIds - previousPending) - alertedOrderIds
                        if (newlyArrived.isNotEmpty()) {
                            alertedOrderIds.addAll(newlyArrived)
                            vibrate()
                            if (mediaPlayer == null) {
                                // A new pending order starts exactly one looping copy of
                                // the uploaded custom sound. It is stopped by the pendingIds
                                // empty condition above when the order is accepted/rejected.
                                refreshAndPlayCustomSound()
                            }
                        }
                    }
                } else if (response.code == 401 || response.code == 403) {
                    stopAlertSound()
                }
            } catch (_: Exception) {
            }

            try {
                Thread.sleep(POLL_MS)
            } catch (_: InterruptedException) {
                break
            }
        }
    }

    private fun isPending(status: String): Boolean {
        return status == "new" ||
            status == "pending" ||
            status == "pending confirmation" ||
            status == "order placed" ||
            status == "placed"
    }

    @Synchronized
    private fun refreshAndPlayCustomSound(loop: Boolean = true) {
        try {
            if (!loop) testPlayback = true
            stopAlertSound()

            val response = apiGet("/api/admin/sound-settings")
            if (response.code != 200) return

            val audioData = JSONObject(response.body).optString("audioData", "")
            if (!audioData.startsWith("data:")) return

            val comma = audioData.indexOf(',')
            if (comma <= 0) return

            val header = audioData.substring(0, comma)
            val payload = audioData.substring(comma + 1)
            val bytes = if (header.contains(";base64", ignoreCase = true)) {
                Base64.getDecoder().decode(payload)
            } else {
                URLDecoder.decode(payload, "UTF-8").toByteArray(Charsets.UTF_8)
            }
            if (bytes.isEmpty()) return

            val file = File(cacheDir, "hotel-malabar-order-alert")
            FileOutputStream(file).use { it.write(bytes) }

            requestAudioFocus()

            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(file.absolutePath)
                isLooping = loop
                setVolume(1f, 1f)
                setOnCompletionListener {
                    if (!loop) {
                        testPlayback = false
                        stopAlertSound()
                    }
                }
                setOnErrorListener { _, _, _ ->
                    testPlayback = false
                    stopAlertSound()
                    true
                }
                prepare()
                start()
            }
        } catch (_: Exception) {
            testPlayback = false
            stopAlertSound()
        }
    }

    private fun requestAudioFocus() {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                val request = android.media.AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
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
                audioFocusGranted = audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            } else {
                @Suppress("DEPRECATION")
                audioFocusGranted = audioManager.requestAudioFocus(
                    null,
                    AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            }
        } catch (_: Exception) {
            audioFocusGranted = false
        }
    }

    @Synchronized
    @Suppress("DEPRECATION")
    private fun stopAlertSound() {
        try { mediaPlayer?.stop() } catch (_: Exception) {}
        try { mediaPlayer?.release() } catch (_: Exception) {}
        mediaPlayer = null

        if (audioFocusGranted) {
            try {
                if (Build.VERSION.SDK_INT >= 26) {
                    audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
                } else {
                    @Suppress("DEPRECATION")
                    audioManager.abandonAudioFocus(null)
                }
            } catch (_: Exception) {}
            audioFocusRequest = null
            audioFocusGranted = false
        }
    }

    private fun vibrate() {
        try {
            val pattern = longArrayOf(0, 300, 150, 300, 150, 600)
            if (Build.VERSION.SDK_INT >= 31) {
                val manager = getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager
                manager.defaultVibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                val vibrator = getSystemService(VIBRATOR_SERVICE) as Vibrator
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
            }
        } catch (_: Exception) {}
    }

    private data class ApiResponse(val code: Int, val body: String)

    private fun apiGet(path: String): ApiResponse {
        val conn = URL(API + path).openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connectTimeout = 12000
        conn.readTimeout = 12000
        conn.setRequestProperty("Authorization", "Bearer $token")
        conn.setRequestProperty("Cache-Control", "no-cache, no-store")
        conn.setRequestProperty("Pragma", "no-cache")
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
        conn.disconnect()
        return ApiResponse(code, body)
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Hotel Malabar Admin Service",
                    NotificationManager.IMPORTANCE_MIN
                ).apply {
                    description = "Silent background service for Hotel Malabar order alerts."
                    setSound(null, null)
                    enableVibration(false)
                    setShowBadge(false)
                }
            )
        }
    }

    private fun buildServiceNotification(text: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, flags)

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

    override fun onTaskRemoved(rootIntent: Intent?) {
        try {
            val restart = Intent(applicationContext, OrderAlertService::class.java)
                .putExtra(EXTRA_TOKEN, token)
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
