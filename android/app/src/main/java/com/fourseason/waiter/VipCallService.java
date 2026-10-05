package com.fourseason.waiter;

import android.app.AlarmManager;
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
import android.util.Log;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

public class VipCallService extends Service {
    private static final String TAG = "VipCallService";
    public static final String ACTION_START_LISTENING = "ACTION_START_LISTENING";
    public static final String ACTION_STOP_LISTENING = "ACTION_STOP_LISTENING";
    public static final String ACTION_TRIGGER_ALARM = "ACTION_TRIGGER_ALARM";
    public static final String ACTION_STOP_ALARM = "ACTION_STOP_ALARM";

    public static final String PREFS_NAME = "FourSeasonVip";
    public static final String KEY_SERVER_URL = "server_url";
    public static final String DEFAULT_SERVER_URL = "https://ais-dev-ci7h2qy5u3hn6xucauliww-11082165761.europe-west2.run.app";

    private static final String CHANNEL_SERVICE_ID = "vip_call_monitor_channel";
    private static final String CHANNEL_ALARM_ID = "vip_call_alarm_channel";
    private static final int NOTIFICATION_SERVICE_ID = 1001;
    public static final int NOTIFICATION_ALARM_ID = 2002;

    private static MediaPlayer sMediaPlayer = null;
    private static Vibrator sVibrator = null;
    private static PowerManager.WakeLock sWakeLock = null;

    private boolean isPolling = false;
    private Thread pollingThread = null;
    private String serverUrl = DEFAULT_SERVER_URL;
    private final Set<String> handledCallIds = new HashSet<>();

    public static String getStoredServerUrl(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL);
    }

    public static void setStoredServerUrl(Context context, String url) {
        if (url != null && !url.trim().isEmpty()) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_SERVER_URL, url.trim()).apply();
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        serverUrl = getStoredServerUrl(this);
        createNotificationChannels();
        Log.d(TAG, "VipCallService created with serverUrl: " + serverUrl);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        // Ensure service runs as high-priority foreground service
        startForeground(NOTIFICATION_SERVICE_ID, buildForegroundNotification("Monitoring VIP Table Calls"));

        if (intent != null && intent.hasExtra("server_url")) {
            String incomingUrl = intent.getStringExtra("server_url");
            if (incomingUrl != null && !incomingUrl.trim().isEmpty()) {
                serverUrl = incomingUrl.trim();
                setStoredServerUrl(this, serverUrl);
            }
        } else {
            serverUrl = getStoredServerUrl(this);
        }

        if (ACTION_STOP_ALARM.equals(action)) {
            stopAlarmAudio(this);
            dismissAlarmNotification();
        } else if (ACTION_TRIGGER_ALARM.equals(action)) {
            String callId = intent != null ? intent.getStringExtra("call_id") : "manual-" + System.currentTimeMillis();
            String tableNumber = intent != null ? intent.getStringExtra("table_number") : "VIP-1";
            String customerName = intent != null ? intent.getStringExtra("customer_name") : "VIP Customer";
            String notes = intent != null ? intent.getStringExtra("notes") : "Service requested immediately";
            triggerIncomingCall(callId, tableNumber, customerName, notes);
        } else if (ACTION_STOP_LISTENING.equals(action)) {
            stopPolling();
            stopSelf();
        } else {
            // Default: start monitoring loop
            startPolling();
        }

        // START_STICKY guarantees OS restarts the service if killed
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.d(TAG, "App task removed (swiped away) -> Scheduling persistent service restart");

        // Immediately schedule restart via AlarmManager so background monitoring never terminates
        Intent restartIntent = new Intent(getApplicationContext(), VipCallService.class);
        restartIntent.setAction(ACTION_START_LISTENING);
        restartIntent.putExtra("server_url", serverUrl);

        PendingIntent pendingIntent = PendingIntent.getService(
            getApplicationContext(),
            999,
            restartIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            long triggerAt = System.currentTimeMillis() + 1000;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            }
        }
    }

    private void startPolling() {
        if (isPolling) return;
        isPolling = true;
        pollingThread = new Thread(new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "VIP Call polling thread active: " + serverUrl);
                while (isPolling) {
                    try {
                        checkActiveCalls();
                    } catch (Exception e) {
                        Log.e(TAG, "Polling loop error: " + e.getMessage());
                    }
                    try {
                        Thread.sleep(2000); // Check every 2 seconds
                    } catch (InterruptedException e) {
                        break;
                    }
                }
            }
        });
        pollingThread.start();
    }

    private void stopPolling() {
        isPolling = false;
        if (pollingThread != null) {
            pollingThread.interrupt();
            pollingThread = null;
        }
    }

    private void checkActiveCalls() {
        try {
            // Primary endpoint for active pending calls
            URL url = new URL(serverUrl + "/api/waiter/calls/active");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();

                String jsonStr = sb.toString().trim();
                JSONArray callsArray = null;

                if (jsonStr.startsWith("{")) {
                    JSONObject obj = new JSONObject(jsonStr);
                    if (obj.has("calls")) {
                        callsArray = obj.getJSONArray("calls");
                    }
                } else if (jsonStr.startsWith("[")) {
                    callsArray = new JSONArray(jsonStr);
                }

                if (callsArray != null) {
                    for (int i = 0; i < callsArray.length(); i++) {
                        JSONObject call = callsArray.getJSONObject(i);
                        String id = call.optString("id");
                        String status = call.optString("status", "pending");
                        if ("pending".equalsIgnoreCase(status) && !handledCallIds.contains(id)) {
                            handledCallIds.add(id);
                            String tableNumber = call.optString("table_number", "VIP");
                            String customerName = call.optString("customer_name", "VIP Customer");
                            String notes = call.optString("notes", "Assistance requested immediately");
                            Log.d(TAG, ">>> VIP CALL DETECTED: " + id + " for Table " + tableNumber);
                            triggerIncomingCall(id, tableNumber, customerName, notes);
                            break;
                        }
                    }
                }
            }
            conn.disconnect();
        } catch (Exception e) {
            // Ignore transient network hiccups and retry on next tick
        }
    }

    private void triggerIncomingCall(String callId, String tableNumber, String customerName, String notes) {
        Log.d(TAG, "Triggering Full-Screen Incoming VIP Call: " + tableNumber);

        // 1. Wake screen up (even if locked or in pocket)
        acquireWakeLock(this);

        // 2. Play loud alarm sound and start vibration (overriding silent and vibrate modes)
        startAlarmAudio(this);

        // 3. Activity Intent
        Intent activityIntent = new Intent(this, IncomingCallActivity.class);
        activityIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        activityIntent.putExtra("call_id", callId);
        activityIntent.putExtra("table_number", tableNumber);
        activityIntent.putExtra("customer_name", customerName);
        activityIntent.putExtra("notes", notes);
        activityIntent.putExtra("server_url", serverUrl);

        try {
            startActivity(activityIntent);
        } catch (Exception e) {
            Log.e(TAG, "Could not launch IncomingCallActivity directly: " + e.getMessage());
        }

        // 4. Full-Screen Intent Notification for lock screen display
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            callId.hashCode(),
            activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // Accept Action Intent
        Intent acceptIntent = new Intent(this, IncomingCallActivity.class);
        acceptIntent.putExtras(activityIntent);
        acceptIntent.putExtra("user_action", "accept");
        PendingIntent acceptPendingIntent = PendingIntent.getActivity(
            this,
            callId.hashCode() + 1,
            acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // Decline Action Intent
        Intent declineIntent = new Intent(this, VipCallService.class);
        declineIntent.setAction(ACTION_STOP_ALARM);
        PendingIntent declinePendingIntent = PendingIntent.getService(
            this,
            callId.hashCode() + 2,
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ALARM_ID)
            .setSmallIcon(R.drawable.ic_stat_bell)
            .setContentTitle("⭐ VIP TABLE " + tableNumber + " CALLING")
            .setContentText(customerName + " - " + notes)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setOngoing(true)
            .setAutoCancel(false)
            .setColor(0xFFD4AF37)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent)
            .addAction(android.R.drawable.ic_menu_call, "ACCEPT CALL", acceptPendingIntent);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ALARM_ID, builder.build());
        }
    }

    private void dismissAlarmNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_ALARM_ID);
        }
    }

    public static synchronized void acquireWakeLock(Context context) {
        try {
            if (sWakeLock == null) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    sWakeLock = pm.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                        PowerManager.ACQUIRE_CAUSES_WAKEUP |
                        PowerManager.ON_AFTER_RELEASE,
                        "FourSeason:IncomingVipCallWakeLock"
                    );
                }
            }
            if (sWakeLock != null && !sWakeLock.isHeld()) {
                sWakeLock.acquire(120000); // 2 minutes wake lock
            }
        } catch (Exception e) {
            Log.e(TAG, "Error acquiring WakeLock: " + e.getMessage());
        }
    }

    public static synchronized void releaseWakeLock() {
        try {
            if (sWakeLock != null && sWakeLock.isHeld()) {
                sWakeLock.release();
                sWakeLock = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error releasing WakeLock: " + e.getMessage());
        }
    }

    public static synchronized void startAlarmAudio(Context context) {
        try {
            // Stop any existing playback first
            stopAlarmAudio(context);

            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                // Ensure alarm stream volume is maximum so it is loud even on silent / vibrate mode
                int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVol, 0);
            }

            // AudioAttributes configured for ALARM - overrides silent and vibrate ringer modes
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                .build();

            // Load and loop bell sound
            try {
                Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.restaurant_bell);
                sMediaPlayer = new MediaPlayer();
                sMediaPlayer.setDataSource(context, soundUri);
                sMediaPlayer.setAudioAttributes(audioAttributes);
                sMediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
                sMediaPlayer.setLooping(true);
                sMediaPlayer.setVolume(1.0f, 1.0f);
                sMediaPlayer.prepare();
                sMediaPlayer.start();
            } catch (Exception rawEx) {
                Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alarmUri == null) {
                    alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                }
                sMediaPlayer = new MediaPlayer();
                sMediaPlayer.setDataSource(context, alarmUri);
                sMediaPlayer.setAudioAttributes(audioAttributes);
                sMediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
                sMediaPlayer.setLooping(true);
                sMediaPlayer.setVolume(1.0f, 1.0f);
                sMediaPlayer.prepare();
                sMediaPlayer.start();
            }

            // Start strong repeating vibration
            sVibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (sVibrator != null && sVibrator.hasVibrator()) {
                long[] pattern = {0, 800, 400, 800, 400, 1000};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    VibrationEffect effect = VibrationEffect.createWaveform(pattern, 0);
                    sVibrator.vibrate(effect, audioAttributes);
                } else {
                    sVibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting alarm audio: " + e.getMessage());
        }
    }

    public static synchronized void stopAlarmAudio(Context context) {
        try {
            if (sMediaPlayer != null) {
                if (sMediaPlayer.isPlaying()) {
                    sMediaPlayer.stop();
                }
                sMediaPlayer.release();
                sMediaPlayer = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping MediaPlayer: " + e.getMessage());
        }

        try {
            if (sVibrator != null) {
                sVibrator.cancel();
                sVibrator = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping Vibrator: " + e.getMessage());
        }

        // Cancel the system vibrator directly to ensure zero lingering vibration
        try {
            Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                v.cancel();
            }
        } catch (Exception e) {
            // Ignore
        }

        // Immediately dismiss the alarm notification
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(NOTIFICATION_ALARM_ID);
            }
        } catch (Exception e) {
            // Ignore
        }

        releaseWakeLock();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            // Background Service Channel
            NotificationChannel serviceChannel = new NotificationChannel(
                CHANNEL_SERVICE_ID,
                "VIP Waiter Service Background Monitor",
                NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Keeps waiter app connected to VIP table call requests");
            nm.createNotificationChannel(serviceChannel);

            // High Priority Alarm Channel
            NotificationChannel alarmChannel = new NotificationChannel(
                CHANNEL_ALARM_ID,
                "VIP Table Urgent Calls",
                NotificationManager.IMPORTANCE_HIGH
            );
            alarmChannel.setDescription("Full-screen notifications and loud alarms for VIP table service");
            alarmChannel.setBypassDnd(true);
            alarmChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            alarmChannel.enableVibration(true);
            alarmChannel.setVibrationPattern(new long[]{0, 800, 400, 800, 400, 1000});

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                .build();
            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.restaurant_bell);
            alarmChannel.setSound(soundUri, audioAttributes);

            nm.createNotificationChannel(alarmChannel);
        }
    }

    private Notification buildForegroundNotification(String statusText) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        return new NotificationCompat.Builder(this, CHANNEL_SERVICE_ID)
            .setContentTitle("Four Season Waiter Live")
            .setContentText(statusText)
            .setSmallIcon(R.drawable.ic_stat_bell)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopPolling();
        stopAlarmAudio(this);
        super.onDestroy();
        Log.d(TAG, "VipCallService destroyed");
    }
}
