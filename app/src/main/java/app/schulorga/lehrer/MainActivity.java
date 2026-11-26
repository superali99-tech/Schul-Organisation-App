package app.schulorga.lehrer;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Insets;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;

/**
 * Native Hülle der SchulOrga-App. Die Oberfläche liegt in assets/www und wird
 * über eine virtuelle HTTPS-Adresse geladen (kein Netzwerkzugriff nötig).
 */
public class MainActivity extends Activity {

    static final String HOST = "appassets.androidplatform.net";
    static final String START_URL = "https://" + HOST + "/www/index.html";
    static final String DATA_FILE = "schulorga-data.json";

    private static final int REQ_FILE_CHOOSER = 11;
    private static final int REQ_SAVE_FILE = 12;
    private static final int REQ_PERM_NOTIF = 13;
    private static final int REQ_PERM_AUDIO = 14;

    private WebView web;
    private FrameLayout root;
    private SplitColorDrawable barBackground;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingSaveBytes;
    private PermissionRequest pendingPermission;
    private String launchRoute;
    private boolean pageReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        boolean dark = isSystemDark();
        barBackground = new SplitColorDrawable(dark ? 0xFF1A1C22 : 0xFFFFFFFF, dark ? 0xFF1A1C22 : 0xFFFFFFFF);
        root.setBackground(barBackground);

        web = new WebView(this);
        web.setBackgroundColor(dark ? 0xFF111318 : 0xFFF5F6FA);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                barBackground.setSplit(bars.top);
                return WindowInsets.CONSUMED;
            });
        }
        applyBarAppearance(!dark);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);
        s.setBuiltInZoomControls(false);
        s.setSupportZoom(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new AppClient());
        web.setWebChromeClient(new AppChrome());

        handleIntent(getIntent());
        web.loadUrl(START_URL);
    }

    // ---------------------------------------------------------------- Lebenszyklus

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
        if (pageReady && launchRoute != null) {
            String r = JSONObject.quote(launchRoute);
            launchRoute = null;
            js("window.App && App.navigate(" + r + ")");
        }
    }

    private void handleIntent(Intent intent) {
        if (intent != null && intent.hasExtra("route")) {
            launchRoute = intent.getStringExtra("route");
            intent.removeExtra("route");
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        js("window.App && App.onPause && App.onPause()");
    }

    @Override
    protected void onResume() {
        super.onResume();
        js("window.App && App.onResume && App.onResume()");
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        js("window.App && App.onSystemTheme && App.onSystemTheme(" + isSystemDark() + ")");
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.App && App.handleBack) ? App.handleBack() : false", value -> {
            if (!"true".equals(value)) {
                finish();
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
        }
        super.onDestroy();
    }

    private void js(String code) {
        if (web != null) {
            web.post(() -> web.evaluateJavascript(code, null));
        }
    }

    boolean isSystemDark() {
        int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    @SuppressWarnings("deprecation")
    private void applyBarAppearance(boolean lightBars) {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(lightBars ? mask : 0, mask);
            }
        } else {
            View decor = getWindow().getDecorView();
            int flags = decor.getSystemUiVisibility();
            if (lightBars) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= 26) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            } else {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= 26) flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            decor.setSystemUiVisibility(flags);
        }
    }

    // ---------------------------------------------------------------- Ergebnisse

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_CHOOSER) {
            if (fileCallback != null) {
                Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                fileCallback.onReceiveValue(result);
                fileCallback = null;
            }
        } else if (requestCode == REQ_SAVE_FILE) {
            boolean ok = false;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingSaveBytes != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    if (out != null) {
                        out.write(pendingSaveBytes);
                        ok = true;
                    }
                } catch (Exception e) {
                    ok = false;
                }
            }
            pendingSaveBytes = null;
            js("window.App && App.onFileSaved && App.onFileSaved(" + ok + ")");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (requestCode == REQ_PERM_AUDIO && pendingPermission != null) {
            if (granted) {
                pendingPermission.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            } else {
                pendingPermission.deny();
            }
            pendingPermission = null;
        } else if (requestCode == REQ_PERM_NOTIF) {
            js("window.App && App.onNotifPermission && App.onNotifPermission(" + granted + ")");
        }
    }

    // ---------------------------------------------------------------- WebView-Clients

    private class AppClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (!HOST.equals(u.getHost())) {
                return null;
            }
            String path = u.getPath();
            if (path == null || path.equals("/") || path.isEmpty()) path = "/www/index.html";
            if (path.startsWith("/")) path = path.substring(1);
            if (path.contains("..")) {
                return new WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", null, null);
            }
            try {
                InputStream in = getAssets().open(path);
                WebResourceResponse r = new WebResourceResponse(mimeFor(path), "utf-8", in);
                java.util.Map<String, String> headers = new java.util.HashMap<>();
                headers.put("Cache-Control", "no-cache");
                r.setResponseHeaders(headers);
                return r;
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (HOST.equals(u.getHost())) {
                return false;
            }
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, u);
                startActivity(i);
            } catch (ActivityNotFoundException e) {
                Toast.makeText(MainActivity.this, "Keine passende App gefunden", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            pageReady = true;
        }
    }

    private static String mimeFor(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".mp3")) return "audio/mpeg";
        return "application/octet-stream";
    }

    private class AppChrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(null);
            }
            fileCallback = callback;
            try {
                Intent intent = params.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                startActivityForResult(intent, REQ_FILE_CHOOSER);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
            return true;
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> {
                boolean audio = Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
                if (!audio) {
                    request.deny();
                    return;
                }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                } else {
                    pendingPermission = request;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_PERM_AUDIO);
                }
            });
        }
    }

    // ---------------------------------------------------------------- Dateien

    private File dataFile() {
        return new File(getFilesDir(), DATA_FILE);
    }

    private File backupDir() {
        File d = new File(getFilesDir(), "auto-backups");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    private static String readFile(File f) throws IOException {
        try (FileInputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    private static void writeFileAtomic(File target, String content) throws IOException {
        File tmp = new File(target.getParentFile(), target.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(content.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        }
        if (!tmp.renameTo(target)) {
            // Fallback: direkt schreiben
            try (FileOutputStream out = new FileOutputStream(target)) {
                out.write(content.getBytes(StandardCharsets.UTF_8));
            }
            tmp.delete();
        }
    }

    private void dailyBackup(String content) {
        try {
            String day = new SimpleDateFormat("yyyy-MM-dd", Locale.GERMANY).format(new Date());
            File f = new File(backupDir(), "auto-" + day + ".json");
            writeFileAtomic(f, content);
            File[] all = backupDir().listFiles((dir, name) -> name.startsWith("auto-") && name.endsWith(".json"));
            if (all != null && all.length > 14) {
                Arrays.sort(all, (a, b) -> a.getName().compareTo(b.getName()));
                for (int i = 0; i < all.length - 14; i++) all[i].delete();
            }
        } catch (Exception ignored) {
        }
    }

    // ---------------------------------------------------------------- JS-Brücke

    public class Bridge {

        @JavascriptInterface
        public String loadData() {
            try {
                File f = dataFile();
                return f.exists() ? readFile(f) : "";
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean saveData(String json) {
            try {
                writeFileAtomic(dataFile(), json);
                dailyBackup(json);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String listBackups() {
            JSONArray arr = new JSONArray();
            File[] all = backupDir().listFiles((dir, name) -> name.endsWith(".json"));
            if (all != null) {
                Arrays.sort(all, (a, b) -> b.getName().compareTo(a.getName()));
                for (File f : all) {
                    try {
                        JSONObject o = new JSONObject();
                        o.put("name", f.getName());
                        o.put("size", f.length());
                        o.put("modified", f.lastModified());
                        arr.put(o);
                    } catch (Exception ignored) {
                    }
                }
            }
            return arr.toString();
        }

        @JavascriptInterface
        public String readBackup(String name) {
            try {
                if (name == null || name.contains("/") || name.contains("..")) return "";
                File f = new File(backupDir(), name);
                return f.exists() ? readFile(f) : "";
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void saveFile(String filename, String mime, String content, boolean isBase64) {
            runOnUiThread(() -> {
                try {
                    pendingSaveBytes = isBase64 ? Base64.decode(content, Base64.DEFAULT)
                            : content.getBytes(StandardCharsets.UTF_8);
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                    i.putExtra(Intent.EXTRA_TITLE, filename);
                    startActivityForResult(i, REQ_SAVE_FILE);
                } catch (Exception e) {
                    pendingSaveBytes = null;
                    js("window.App && App.onFileSaved && App.onFileSaved(false)");
                }
            });
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_SUBJECT, title);
                i.putExtra(Intent.EXTRA_TEXT, text);
                try {
                    startActivity(Intent.createChooser(i, title));
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void print(String jobName) {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                if (pm == null) return;
                final PrintDocumentAdapter base = web.createPrintDocumentAdapter(jobName);
                PrintDocumentAdapter wrapped = new PrintDocumentAdapter() {
                    @Override
                    public void onStart() {
                        base.onStart();
                    }

                    @Override
                    public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                                         CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
                        base.onLayout(oldAttributes, newAttributes, cancellationSignal, callback, extras);
                    }

                    @Override
                    public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                                        CancellationSignal cancellationSignal, WriteResultCallback callback) {
                        base.onWrite(pages, destination, cancellationSignal, callback);
                    }

                    @Override
                    public void onFinish() {
                        base.onFinish();
                        js("window.App && App.onPrintDone && App.onPrintDone()");
                    }
                };
                PrintAttributes attrs = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .build();
                pm.print(jobName, wrapped, attrs);
            });
        }

        @JavascriptInterface
        public void syncReminders(String json) {
            Reminders.sync(getApplicationContext(), json);
        }

        @JavascriptInterface
        public boolean notificationsAllowed() {
            if (Build.VERSION.SDK_INT >= 33) {
                return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            }
            return true;
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_PERM_NOTIF);
                } else {
                    js("window.App && App.onNotifPermission && App.onNotifPermission(true)");
                }
            });
        }

        @JavascriptInterface
        public boolean isSystemDark() {
            return MainActivity.this.isSystemDark();
        }

        @JavascriptInterface
        public void setBarColors(String top, String bottom, boolean lightBars) {
            runOnUiThread(() -> {
                try {
                    int t = Color.parseColor(top);
                    int b = Color.parseColor(bottom);
                    barBackground.setColors(t, b);
                    if (Build.VERSION.SDK_INT < 30) {
                        getWindow().setStatusBarColor(t);
                        getWindow().setNavigationBarColor(b);
                    }
                    applyBarAppearance(lightBars);
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void setPageBackground(String color) {
            runOnUiThread(() -> {
                try {
                    web.setBackgroundColor(Color.parseColor(color));
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        @SuppressWarnings("deprecation")
        public void vibrate(int ms) {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v == null) return;
            if (Build.VERSION.SDK_INT >= 26) {
                v.vibrate(VibrationEffect.createOneShot(Math.max(10, ms), VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                v.vibrate(ms);
            }
        }

        @JavascriptInterface
        public void keepScreenOn(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void setSecure(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            });
        }

        @JavascriptInterface
        public String getLaunchRoute() {
            String r = launchRoute;
            launchRoute = null;
            return r == null ? "" : r;
        }

        @JavascriptInterface
        public String appVersion() {
            try {
                PackageInfo p = getPackageManager().getPackageInfo(getPackageName(), 0);
                return p.versionName;
            } catch (Exception e) {
                return "1.0";
            }
        }

        @JavascriptInterface
        public void toast(String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(MainActivity.this::finish);
        }
    }

    // ---------------------------------------------------------------- Hintergrund der Systemleisten

    /** Zeichnet oben (Statusleiste) und unten (Navigationsleiste) unterschiedliche Farben. */
    static class SplitColorDrawable extends Drawable {
        private final Paint top = new Paint();
        private final Paint bottom = new Paint();
        private int split = 0;

        SplitColorDrawable(int topColor, int bottomColor) {
            top.setColor(topColor);
            bottom.setColor(bottomColor);
        }

        void setColors(int t, int b) {
            top.setColor(t);
            bottom.setColor(b);
            invalidateSelf();
        }

        void setSplit(int px) {
            split = px;
            invalidateSelf();
        }

        @Override
        public void draw(Canvas canvas) {
            Rect r = getBounds();
            int mid = Math.max(split, r.height() / 2);
            canvas.drawRect(r.left, r.top, r.right, r.top + mid, top);
            canvas.drawRect(r.left, r.top + mid, r.right, r.bottom, bottom);
        }

        @Override
        public void setAlpha(int alpha) {
        }

        @Override
        public void setColorFilter(ColorFilter colorFilter) {
        }

        @Override
        public int getOpacity() {
            return PixelFormat.OPAQUE;
        }
    }
}
