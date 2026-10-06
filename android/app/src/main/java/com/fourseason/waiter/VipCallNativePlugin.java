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

    private static final String DEFAULT_SERVER_URL = "https://ais-dev-ci7h2qy5u3hn6xucauliww-11082165761.europe-west2.run.app";

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

        Intent serviceIntent = new Intent(context, VipCallService.class);
        serviceIntent.setAction(VipCallService.ACTION_START_LISTENING);
        serviceIntent.putExtra("server_url", serverUrl);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }

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
        Intent serviceIntent = new Intent(context, VipCallService.class);
        serviceIntent.setAction(VipCallService.ACTION_STOP_LISTENING);
        context.stopService(serviceIntent);

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
        String callId = call.getString("callId", "test-" + System.currentTimeMillis());
        String tableNumber = call.getString("tableNumber", "VIP-1");
        String customerName = call.getString("customerName", "VIP Customer");
        String notes = call.getString("notes", "Urgent VIP assistance requested");

        Intent alarmIntent = new Intent(context, VipCallService.class);
        alarmIntent.setAction(VipCallService.ACTION_TRIGGER_ALARM);
        alarmIntent.putExtra("call_id", callId);
        alarmIntent.putExtra("table_number", tableNumber);
        alarmIntent.putExtra("customer_name", customerName);
        alarmIntent.putExtra("notes", notes);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(alarmIntent);
        } else {
            context.startService(alarmIntent);
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
        VipCallService.stopAlarmAudio(context);

        Intent stopIntent = new Intent(context, VipCallService.class);
        stopIntent.setAction(VipCallService.ACTION_STOP_ALARM);
        context.startService(stopIntent);

        JSObject ret = new JSObject();
        ret.put("stopped", true);
        ret.put("status", "silenced");
        call.resolve(ret);
    }
}
