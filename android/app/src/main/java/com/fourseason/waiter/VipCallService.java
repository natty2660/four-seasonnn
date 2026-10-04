package com.fourseason.waiter;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

public class VipCallService extends Service {

    public static final String CALL_CHANNEL_ID = "vip_call_channel";
    public static final String STATUS_CHANNEL_ID = "vip_status_channel";
    private static final int FOREGROUND_STATUS_NOTIF_ID = 1001;
    private static final int INCOMING_CALL_NOTIF_ID = 2002;

    private static MediaPlayer sMediaPlayer = null;
    private static Vibrator sVibrator = null;
    private static PowerManager.WakeLock sWakeLock = null;
    private static boolean sIsRinging = false;
    private static String sCurrentRingingCallId = null;

    private boolean isRunning = false;
    private ExecutorService backgroundExecutor;
    private String serverUrl = "http://10.0.2.2:3000";
    private String waiterId = "";
    private String waiterName = "";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        backgroundExecutor = Executors.newSingleThreadExecutor();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("STOP_ALERT".equals(action)) {
                stopCallAlert(this);
                return START_STICKY;
            } else if ("MUTE_SOUND".equals(action)) {
                muteSound(this);
                return START_STICKY;
            }

            if (intent.hasExtra("server_url")) {
                serverUrl = intent.getStringExtra("server_url");
            }
            if (intent.hasExtra("waiter_id")) {
                waiterId = intent.getStringExtra("waiter_id");
            }
            if (intent.hasExtra("waiter_name")) {
                waiterName = intent.getStringExtra("waiter_name");
            }
        }

        // Persist configs
        SharedPreferences prefs = getSharedPreferences("FourSeasonWaiterPrefs", Context.MODE_PRIVATE);
        if (waiterId.isEmpty()) {
            waiterId = prefs.getString("waiter_id", "");
            waiterName = prefs.getString("waiter_name", "Waiter");
            serverUrl = prefs.getString("server_url", "http://10.0.2.2:3000");
        } else {
            prefs.edit()
                .putString("waiter_id", waiterId)
                .putString("waiter_name", waiterName)
                .putString("server_url", serverUrl)
                .apply();
        }

        // Start Foreground Notification so Android OS does not kill this service when app is swiped away
        startForeground(FOREGROUND_STATUS_NOTIF_ID, createServiceNotification());

        if (!isRunning) {
            isRunning = true;
            startPollingLoop();
        }

        return START_STICKY;
    }

    private Notification createServiceNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        String title = "Four Season Waiter Active";
        String content = waiterName.isEmpty()
            ? "Floor alerts ready • Listening for VIP calls"
            : "Active for " + waiterName + " • Listening for VIP calls";

        return new NotificationCompat.Builder(this, STATUS_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // 1. VIP Call High-Priority Channel for ringing & lockscreen full-screen intents
            NotificationChannel callChannel = new NotificationChannel(
                CALL_CHANNEL_ID,
                "VIP Table Urgent Calls",
                NotificationManager.IMPORTANCE_HIGH
            );
            callChannel.setDescription("Rings loudly and vibrates continuously for incoming VIP table calls");
            callChannel.enableLights(true);
            callChannel.enableVibration(true);
            callChannel.setVibrationPattern(new long[]{0, 1000, 400, 1000, 400, 1500});
            callChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (ringtoneUri == null) ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            callChannel.setSound(ringtoneUri, audioAttributes);
            nm.createNotificationChannel(callChannel);

            // 2. Background listener status channel
            NotificationChannel statusChannel = new NotificationChannel(
                STATUS_CHANNEL_ID,
                "Waiter Service Status",
                NotificationManager.IMPORTANCE_LOW
            );
            statusChannel.setDescription("Keeps the VIP listener active when app is closed");
            nm.createNotificationChannel(statusChannel);
        }
    }

    /**
     * Continuous background polling thread that checks server for pending VIP calls
     * even when the app is swiped away or phone is locked in the pocket.
     */
    private void startPollingLoop() {
        backgroundExecutor.execute(() -> {
            while (isRunning) {
                try {
                    if (!waiterId.isEmpty() && serverUrl != null && !serverUrl.isEmpty()) {
                        checkServerForCalls();
                    }
                    Thread.sleep(2500); // Poll every 2.5 seconds for instant call pickup
                } catch (InterruptedException e) {
                    break;
                } catch (Exception e) {
                    try { Thread.sleep(4000); } catch (Exception ignored) {}
                }
            }
        });
    }

    private void checkServerForCalls() {
        try {
            URL url = new URL(serverUrl + "/api/waiter-calls?status=pending");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);

            int code = conn.getResponseCode();
            if (code == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();

                JSONArray calls = new JSONArray(sb.toString());
                boolean foundCallForMe = false;
                JSONObject topCall = null;

                for (int i = 0; i < calls.length(); i++) {
                    JSONObject c = calls.getJSONObject(i);
                    String status = c.optString("status");
                    if (!"pending".equals(status)) continue;

                    boolean isEscalated = c.optBoolean("is_escalated", false);
                    String assignedWaiter = c.optString("assigned_waiter_id", "");

                    // Call should ring if:
                    // 1. Assigned specifically to this waiter
                    // 2. Unassigned
                    // 3. Escalated after 45s
                    if (isEscalated || assignedWaiter.isEmpty() || assignedWaiter.equals(waiterId)) {
                        foundCallForMe = true;
                        topCall = c;
                        break;
                    }
                }

                if (foundCallForMe && topCall != null) {
                    String callId = topCall.optString("id");
                    if (!sIsRinging || !callId.equals(sCurrentRingingCallId)) {
                        String tableNumber = topCall.optString("table_number", "VIP-1");
                        String tableName = topCall.optString("table_name", "VIP Table");
                        String callType = topCall.optString("call_type", "general");
                        boolean isEscalated = topCall.optBoolean("is_escalated", false);

                        triggerCallAlert(this, callId, tableNumber, tableName, callType, isEscalated);
                    }
                } else {
                    // No pending calls for this waiter: stop ringing if was ringing
                    if (sIsRinging) {
                        stopCallAlert(this);
                    }
                }
            }
            conn.disconnect();
        } catch (Exception e) {
            // Server temporarily unreachable
        }
    }

    /**
     * Triggers full-screen alert, wakes locked screen, plays loud alarm audio stream,
     * and activates continuous heavy pocket vibration.
     */
    public static synchronized void triggerCallAlert(
        Context context,
        String callId,
        String tableNumber,
        String tableName,
        String callType,
        boolean isEscalated
    ) {
        sCurrentRingingCallId = callId;
        sIsRinging = true;

        // 1. Wake the device screen even if locked and in pocket
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                if (sWakeLock != null && sWakeLock.isHeld()) {
                    sWakeLock.release();
                }
                sWakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "fourseason:incoming_call_wake"
                );
                sWakeLock.acquire(60000); // 60 seconds max wake
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 2. Play continuous loud alarm stream sound (overrides silent/vibrate mode)
        try {
            if (sMediaPlayer != null) {
                try { sMediaPlayer.stop(); sMediaPlayer.release(); } catch (Exception ignored) {}
                sMediaPlayer = null;
            }

            Uri alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (alertUri == null) alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);

            sMediaPlayer = new MediaPlayer();
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            sMediaPlayer.setAudioAttributes(audioAttributes);
            sMediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
            sMediaPlayer.setDataSource(context, alertUri);
            sMediaPlayer.setLooping(true);
            sMediaPlayer.prepare();
            sMediaPlayer.start();
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 3. Start strong continuous pocket vibration
        try {
            if (sVibrator == null) {
                sVibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (sVibrator != null) {
                long[] pattern = { 0, 1000, 400, 1000, 400, 1500 };
                AudioAttributes vibAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    sVibrator.vibrate(VibrationEffect.createWaveform(pattern, 0), vibAttributes); // 0 = loop!
                } else {
                    sVibrator.vibrate(pattern, 0); // repeat at 0
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 4. Fire Full-Screen Intent Notification to wake locked screen & show IncomingCallActivity
        try {
            Intent fullScreenIntent = new Intent(context, IncomingCallActivity.class);
            fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            fullScreenIntent.putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId);
            fullScreenIntent.putExtra(IncomingCallActivity.EXTRA_TABLE_NUMBER, tableNumber);
            fullScreenIntent.putExtra(IncomingCallActivity.EXTRA_TABLE_NAME, tableName);
            fullScreenIntent.putExtra(IncomingCallActivity.EXTRA_CALL_TYPE, callType);
            fullScreenIntent.putExtra(IncomingCallActivity.EXTRA_IS_ESCALATED, isEscalated);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                context,
                INCOMING_CALL_NOTIF_ID,
                fullScreenIntent,
                flags
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CALL_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("👑 VIP TABLE " + tableNumber + " IS CALLING!")
                .setContentText("Request: " + callType.toUpperCase() + " • Tap to accept now")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setFullScreenIntent(fullScreenPendingIntent, true) // REQUIRED TO LAUNCH OVER LOCK SCREEN
                .setContentIntent(fullScreenPendingIntent)
                .setOngoing(true)
                .setAutoCancel(false);

            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(INCOMING_CALL_NOTIF_ID, builder.build());
            }

            // Also start IncomingCallActivity directly if screen is currently on/unlocked or locked
            context.startActivity(fullScreenIntent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Mutes sound only, keeps vibration active
     */
    public static synchronized void muteSound(Context context) {
        if (sMediaPlayer != null) {
            try {
                if (sMediaPlayer.isPlaying()) sMediaPlayer.stop();
                sMediaPlayer.release();
            } catch (Exception ignored) {}
            sMediaPlayer = null;
        }
    }

    /**
     * Stops ringing sound, vibration, dismisses incoming call notification, and releases wake lock
     */
    public static synchronized void stopCallAlert(Context context) {
        sIsRinging = false;
        sCurrentRingingCallId = null;

        // Stop Audio
        if (sMediaPlayer != null) {
            try {
                if (sMediaPlayer.isPlaying()) sMediaPlayer.stop();
                sMediaPlayer.release();
            } catch (Exception ignored) {}
            sMediaPlayer = null;
        }

        // Stop Vibration
        if (sVibrator != null) {
            try { sVibrator.cancel(); } catch (Exception ignored) {}
        }

        // Cancel Notification
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(INCOMING_CALL_NOTIF_ID);
            }
        } catch (Exception ignored) {}

        // Release WakeLock
        try {
            if (sWakeLock != null && sWakeLock.isHeld()) {
                sWakeLock.release();
                sWakeLock = null;
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // If user swipes away app from recent apps, ensure the service restarts!
        Intent restartService = new Intent(getApplicationContext(), VipCallService.class);
        restartService.setPackage(getPackageName());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(restartService);
        } else {
            startService(restartService);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        stopCallAlert(this);
        if (backgroundExecutor != null) {
            backgroundExecutor.shutdownNow();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
