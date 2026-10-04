package com.fourseason.waiter;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VipCallNative")
public class VipCallNativePlugin extends Plugin {

    @PluginMethod
    public void startVipCallService(PluginCall call) {
        String waiterId = call.getString("waiterId", "");
        String waiterName = call.getString("waiterName", "Waiter");
        String serverUrl = call.getString("serverUrl", "http://10.0.2.2:3000");

        Context context = getContext();
        Intent serviceIntent = new Intent(context, VipCallService.class);
        serviceIntent.putExtra("waiter_id", waiterId);
        serviceIntent.putExtra("waiter_name", waiterName);
        serviceIntent.putExtra("server_url", serverUrl);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }

        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopVipCallService(PluginCall call) {
        Context context = getContext();
        Intent serviceIntent = new Intent(context, VipCallService.class);
        context.stopService(serviceIntent);
        VipCallService.stopCallAlert(context);

        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void triggerCallAlert(PluginCall call) {
        String callId = call.getString("callId", "test_call");
        String tableNumber = call.getString("tableNumber", "VIP-1");
        String tableName = call.getString("tableName", "VIP Table");
        String callType = call.getString("callType", "general");
        boolean isEscalated = Boolean.TRUE.equals(call.getBoolean("isEscalated", false));

        VipCallService.triggerCallAlert(
            getContext(),
            callId,
            tableNumber,
            tableName,
            callType,
            isEscalated
        );

        JSObject ret = new JSObject();
        ret.put("triggered", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopCallAlert(PluginCall call) {
        VipCallService.stopCallAlert(getContext());

        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void muteSound(PluginCall call) {
        VipCallService.muteSound(getContext());

        JSObject ret = new JSObject();
        ret.put("muted", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void testAlarmRinging(PluginCall call) {
        VipCallService.triggerCallAlert(
            getContext(),
            "test_" + System.currentTimeMillis(),
            "VIP-TEST",
            "Hardware Sound & Vibration Test",
            "urgent",
            false
        );

        JSObject ret = new JSObject();
        ret.put("testing", true);
        call.resolve(ret);
    }
}
