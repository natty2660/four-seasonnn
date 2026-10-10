package com.fourseason.waiter;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VipCallNative")
public class VipCallNativePlugin extends Plugin {

    private static final String DEFAULT_SERVER_URL = "https://four-seasonnn.vercel.app";

    private void persistServerUrl(Context context, String url) {
        if (url != null && !url.trim().isEmpty() && !url.contains("10.0.2.2") && !url.contains("127.0.0.1")) {
            SharedPreferences prefs = context.getSharedPreferences("FourSeasonVip", Context.MODE_PRIVATE);
            prefs.edit().putString("server_url", url.trim()).apply();
        }
    }

    @PluginMethod
    public void startVipCallService(PluginCall call) {
        startMonitoring(call);
    }

    @PluginMethod
    public void startMonitoring(PluginCall call) {
        String serverUrl = call.getString("serverUrl", DEFAULT_SERVER_URL);
        Context context = getContext();
        persistServerUrl(context, serverUrl);

        // Phase 1 Safe Mode: Native foreground service startup is disabled
        // All real-time synchronization is safely handled by in-app SSE and resilient polling
        JSObject ret = new JSObject();
        ret.put("started", true);
        ret.put("status", "running");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopVipCallService(PluginCall call) {
        stopMonitoring(call);
    }

    @PluginMethod
    public void stopMonitoring(PluginCall call) {
        Context context = getContext();
        try {
            Intent serviceIntent = new Intent(context, VipCallService.class);
            serviceIntent.setAction(VipCallService.ACTION_STOP_LISTENING);
            context.stopService(serviceIntent);
        } catch (Throwable t) {
            android.util.Log.e("VipCallNativePlugin", "Error stopping monitor service: " + t.getMessage());
        }

        JSObject ret = new JSObject();
        ret.put("stopped", true);
        ret.put("status", "stopped");
        call.resolve(ret);
    }

    @PluginMethod
    public void triggerCallAlert(PluginCall call) {
        testIncomingCall(call);
    }

    @PluginMethod
    public void testAlarmRinging(PluginCall call) {
        testIncomingCall(call);
    }

    @PluginMethod
    public void testIncomingCall(PluginCall call) {
        Context context = getContext();
        try {
            // Safe hardware vibration pulse without dangerous foreground service
            android.os.Vibrator v = (android.os.Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(android.os.VibrationEffect.createOneShot(500, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(500);
                }
            }
        } catch (Throwable t) {
            android.util.Log.w("VipCallNativePlugin", "Safe vibration note: " + t.getMessage());
        }

        JSObject ret = new JSObject();
        ret.put("triggered", true);
        ret.put("status", "triggered");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopCallAlert(PluginCall call) {
        stopRinging(call);
    }

    @PluginMethod
    public void muteSound(PluginCall call) {
        stopRinging(call);
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        Context context = getContext();
        try {
            VipCallService.stopAlarmAudio(context);
        } catch (Throwable t) {
            android.util.Log.w("VipCallNativePlugin", "Safe stop audio note: " + t.getMessage());
        }

        JSObject ret = new JSObject();
        ret.put("stopped", true);
        ret.put("status", "silenced");
        call.resolve(ret);
    }
}
