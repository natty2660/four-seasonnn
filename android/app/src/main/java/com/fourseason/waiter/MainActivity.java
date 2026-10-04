package com.fourseason.waiter;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VipCallNativePlugin.class);
        super.onCreate(savedInstanceState);

        // Start VIP call background service
        startVipService();

        // Check if opened from an incoming call
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void startVipService() {
        try {
            Intent serviceIntent = new Intent(this, VipCallService.class);
            serviceIntent.setAction(VipCallService.ACTION_START_LISTENING);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent != null && "accepted".equals(intent.getStringExtra("call_action"))) {
            // Dismiss audio
            VipCallService.stopAlarmAudio(this);
        }
    }
}
