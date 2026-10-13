package app.starpath.football;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.view.View;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Compatibility mode (software drawing): bypasses the GPU driver for the WebView on devices whose
 * driver stalls when a game screen starts (src/platform/renderMode.ts). The setting lives in
 * SharedPreferences so MainActivity can apply it before the WebView draws anything.
 */
@CapacitorPlugin(name = "SpRender")
public class SpRenderPlugin extends Plugin {
    static final String PREFS = "sp_render";
    static final String KEY_SOFTWARE = "software";
    static final String KEY_UNRESPONSIVE = "unresponsive";

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isSoftware(Context c) {
        return prefs(c).getBoolean(KEY_SOFTWARE, false);
    }

    /** Counted by MainActivity when the WebView renderer stops answering (Android 10+). */
    static void countUnresponsive(Context c) {
        SharedPreferences p = prefs(c);
        p.edit().putInt(KEY_UNRESPONSIVE, p.getInt(KEY_UNRESPONSIVE, 0) + 1).apply();
    }

    static void applyLayer(WebView wv, boolean software) {
        if (wv == null) return;
        wv.setLayerType(software ? View.LAYER_TYPE_SOFTWARE : View.LAYER_TYPE_HARDWARE, null);
    }

    private JSObject info() {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("software", isSoftware(c));
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        r.put("active", wv != null && wv.getLayerType() == View.LAYER_TYPE_SOFTWARE);
        r.put("unresponsive", prefs(c).getInt(KEY_UNRESPONSIVE, 0));
        r.put("android", Build.VERSION.RELEASE);
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("model", Build.MANUFACTURER + " " + Build.MODEL);
        return r;
    }

    @PluginMethod
    public void get(PluginCall call) {
        getActivity().runOnUiThread(() -> call.resolve(info()));
    }

    @PluginMethod
    public void set(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("software", false));
        boolean now = Boolean.TRUE.equals(call.getBoolean("applyNow", false));
        prefs(getContext()).edit().putBoolean(KEY_SOFTWARE, on).commit();
        getActivity().runOnUiThread(() -> {
            if (now) applyLayer(getBridge().getWebView(), on);
            call.resolve(info());
        });
    }
}
