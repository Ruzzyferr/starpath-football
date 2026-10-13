package app.starpath.football;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewRenderProcess;
import android.webkit.WebViewRenderProcessClient;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SpRenderPlugin.class);
        super.onCreate(savedInstanceState);
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv == null) return;
        // Compatibility mode (Settings > Graphics): software drawing, before the WebView draws anything.
        if (SpRenderPlugin.isSoftware(this)) SpRenderPlugin.applyLayer(wv, true);
        // Diagnostics: count renderer hangs (input not answered for ~5 s) so the next start can tell.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            wv.setWebViewRenderProcessClient(new WebViewRenderProcessClient() {
                @Override
                public void onRenderProcessUnresponsive(WebView view, WebViewRenderProcess renderer) {
                    SpRenderPlugin.countUnresponsive(MainActivity.this);
                }

                @Override
                public void onRenderProcessResponsive(WebView view, WebViewRenderProcess renderer) {}
            });
        }
    }
}
