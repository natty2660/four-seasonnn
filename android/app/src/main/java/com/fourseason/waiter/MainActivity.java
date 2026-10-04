package com.fourseason.waiter;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.WindowManager;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public static final String CALL_CHANNEL_ID = "vip_call_channel";
    public static final String STATUS_CHANNEL_ID = "vip_status_channel";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom native plugin before super.onCreate
        registerPlugin(VipCallNativePlugin.class);

        super.onCreate(savedInstanceState);

        // Enable screen wake & display over lockscreen for incoming VIP calls
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }

        createVipIncomingCallNotificationChannel();
        requestIgnoreBatteryOptimizations();
    }

    /**
     * Prompts Android to exclude this app from aggressive background sleep killing (Doze mode)
     * so that the waiter's phone reliably rings in the pocket.
     */
    private void requestIgnoreBatteryOptimizations() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                String packageName = getPackageName();
                if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    startActivity(intent);
                }
            } catch (Exception ignored) {
                // Device-specific setting, ignore if blocked
            }
        }
    }

    /**
     * Creates a high-priority Android notification channel configured specifically
     * for incoming phone-call style ringing, vibration, and lock screen visibility.
     */
    private void createVipIncomingCallNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager == null) return;

            // 1. VIP Call Channel
            CharSequence name = "VIP Table Incoming Calls";
            String description = "Urgent high-priority ringing & vibration when VIP customers call the waiter";
            int importance = NotificationManager.IMPORTANCE_HIGH;

            NotificationChannel channel = new NotificationChannel(CALL_CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 1000, 400, 1000, 400, 1500});
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            // Use default ringtone or alarm sound for maximum loudness
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (soundUri == null) {
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();

            channel.setSound(soundUri, audioAttributes);
            notificationManager.createNotificationChannel(channel);

            // 2. Status Channel
            NotificationChannel statusChannel = new NotificationChannel(
                STATUS_CHANNEL_ID,
                "Waiter Service Status",
                NotificationManager.IMPORTANCE_LOW
            );
            statusChannel.setDescription("Keeps the VIP listener active when app is closed");
            notificationManager.createNotificationChannel(statusChannel);
        }
    }
}
