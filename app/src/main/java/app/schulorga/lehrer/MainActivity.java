package app.schulorga.lehrer;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
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
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.LayerDrawable;
import android.view.Gravity;
import android.view.ViewTreeObserver;
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
 * Native Hülle der Schulplan-App. Die Oberfläche liegt in assets/www und wird
 * über eine virtuelle HTTPS-Adresse geladen (kein Netzwerkzugriff nötig).
 */
public class MainActivity extends Activity {

    static final String HOST = "appassets.androidplatform.net";
    static final String START_URL = "https://" + HOST + "/www/index.html";
    static final String DATA_FILE = "schulorga-data.json";

    private static final int REQ_FILE_CHOOSER = 11;
    private static final int REQ_SAVE_FILE = 12;
    private static final int REQ_PERM_NOTIF = 13;
    private static final int REQ_PERM_MEDIA = 14;
    private static final int REQ_SYNC_PICK = 15;

    private WebView web;
    private FrameLayout root;
    private SplitColorDrawable barBackground;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingSaveBytes;
    private PermissionRequest pendingPermission;
    private String launchRoute;
    private String pendingIncoming;
    private String[] pendingResources;
    private boolean pageReady = false;
    private volatile boolean uiReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Farben vom letzten Start übernehmen, damit nichts weiß aufblitzt
        SharedPreferences ui = getSharedPreferences("ui", MODE_PRIVATE);
        boolean dark = ui.contains("dark") ? ui.getBoolean("dark", false) : isSystemDark();
        int bg = ui.getInt("bg", dark ? 0xFF0B0D13 : 0xFFF3F4FA);
        getWindow().setBackgroundDrawable(splash(bg));

        root = new FrameLayout(this);
        barBackground = new SplitColorDrawable(bg, bg);
        root.setBackground(barBackground);

        web = new WebView(this);
        web.setBackgroundColor(bg);
        web.setAlpha(0f); // erst einblenden, wenn die Oberfläche fertig gezeichnet ist
        if (Build.VERSION.SDK_INT >= 31) {
            // Den System-Startbildschirm (App-Symbol) zeigen, bis die Oberfläche fertig ist
            web.setAlpha(1f);
            final View content = findViewById(android.R.id.content);
            content.getViewTreeObserver().addOnPreDrawListener(new ViewTreeObserver.OnPreDrawListener() {
                @Override
                public boolean onPreDraw() {
                    if (!uiReady) return false;
                    content.getViewTreeObserver().removeOnPreDrawListener(this);
                    return true;
                }
            });
        }
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
                barBackground.setInsets(bars.top, Math.max(bars.bottom, ime.bottom));
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
        root.postDelayed(this::markReady, 2500); // Sicherheitsnetz
        Updater.scheduleDaily(getApplicationContext());
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
        if (intent == null) return;
        if (intent.hasExtra("route")) {
            launchRoute = intent.getStringExtra("route");
            intent.removeExtra("route");
        }
        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action) && intent.getData() != null) {
            Uri u = intent.getData();
            if ("schulorga".equals(u.getScheme())) deliverIncoming(u.toString());
            else readIncomingUri(u);
        } else if (Intent.ACTION_SEND.equals(action)) {
            Uri stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (stream != null) readIncomingUri(stream);
            else if (text != null) deliverIncoming(text);
        }
        intent.setAction(Intent.ACTION_MAIN);
        intent.setData(null);
    }

    private void readIncomingUri(Uri u) {
        new Thread(() -> {
            try (InputStream in = getContentResolver().openInputStream(u)) {
                if (in == null) return;
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    if (out.size() > 30 * 1024 * 1024) break;
                }
                String text = out.toString("UTF-8");
                runOnUiThread(() -> deliverIncoming(text));
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(this, "Datei konnte nicht gelesen werden", Toast.LENGTH_SHORT).show());
            }
        }).start();
    }

    private void deliverIncoming(String text) {
        if (pageReady) {
            js("window.App && App.onIncoming && App.onIncoming(" + JSONObject.quote(text) + ")");
        } else {
            pendingIncoming = text;
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

    private void showWeb() {
        if (web != null && web.getAlpha() < 1f) web.animate().alpha(1f).setDuration(140).start();
    }

    private void markReady() {
        if (uiReady) return;
        uiReady = true;
        showWeb();
        if (root != null) root.invalidate();
    }

    /** Hintergrund während des Ladens: Farbe + App-Symbol in der Mitte. */
    private Drawable splash(int bg) {
        try {
            Drawable icon = getDrawable(R.mipmap.ic_launcher_round);
            LayerDrawable ld = new LayerDrawable(new Drawable[]{new ColorDrawable(bg), icon});
            int size = Math.round(96 * getResources().getDisplayMetrics().density);
            ld.setLayerGravity(1, Gravity.CENTER);
            ld.setLayerSize(1, size, size);
            return ld;
        } catch (Exception e) {
            return new ColorDrawable(bg);
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
        } else if (requestCode == REQ_SYNC_PICK) {
            boolean ok = false;
            String name = "";
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri u = data.getData();
                try {
                    getContentResolver().takePersistableUriPermission(u,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                } catch (Exception ignored) {
                }
                name = displayName(u);
                prefs().edit().putString("syncUri", u.toString()).putString("syncName", name).apply();
                ok = true;
            }
            js("window.App && App.onSyncPicked && App.onSyncPicked(" + ok + "," + JSONObject.quote(name) + ")");
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
        if (requestCode == REQ_PERM_MEDIA && pendingPermission != null) {
            grantAvailable(pendingPermission, pendingResources);
            pendingPermission = null;
            pendingResources = null;
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
            web.postDelayed(MainActivity.this::markReady, 900); // Sicherheitsnetz
            if (pendingIncoming != null) {
                String t = pendingIncoming;
                pendingIncoming = null;
                deliverIncoming(t);
            }
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
        if (p.endsWith(".mp4")) return "video/mp4";
        if (p.endsWith(".webm")) return "video/webm";
        if (p.endsWith(".webp")) return "image/webp";
        return "application/octet-stream";
    }

    private static String permissionFor(String resource) {
        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) return Manifest.permission.RECORD_AUDIO;
        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) return Manifest.permission.CAMERA;
        return null;
    }

    private void grantAvailable(PermissionRequest request, String[] res) {
        java.util.List<String> ok = new java.util.ArrayList<>();
        for (String r : res) {
            String perm = permissionFor(r);
            if (perm != null && checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED) ok.add(r);
        }
        if (ok.isEmpty()) request.deny();
        else request.grant(ok.toArray(new String[0]));
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
                String[] res = request.getResources();
                java.util.List<String> missing = new java.util.ArrayList<>();
                for (String r : res) {
                    String perm = permissionFor(r);
                    if (perm != null && checkSelfPermission(perm) != PackageManager.PERMISSION_GRANTED) missing.add(perm);
                }
                if (missing.isEmpty()) {
                    grantAvailable(request, res);
                } else {
                    pendingPermission = request;
                    pendingResources = res;
                    requestPermissions(missing.toArray(new String[0]), REQ_PERM_MEDIA);
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

    private SharedPreferences prefs() {
        return getSharedPreferences("sync", MODE_PRIVATE);
    }

    private String displayName(Uri u) {
        try (android.database.Cursor c = getContentResolver().query(u,
                new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {
        }
        String last = u.getLastPathSegment();
        return last == null ? "Team-Datei" : last;
    }

    private String readUri(Uri u) throws IOException {
        try (InputStream in = getContentResolver().openInputStream(u)) {
            if (in == null) return "";
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    private void writeUri(Uri u, String content) throws IOException {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        OutputStream out;
        try {
            out = getContentResolver().openOutputStream(u, "wt");
        } catch (Exception e) {
            out = getContentResolver().openOutputStream(u, "w");
        }
        if (out == null) throw new IOException("kein Zugriff");
        try (OutputStream o = out) {
            o.write(bytes);
            o.flush();
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
        public void shareFile(String filename, String mime, String content, String text) {
            runOnUiThread(() -> {
                try {
                    String safe = filename.replaceAll("[^A-Za-z0-9._ -]", "_");
                    File f = new File(ShareProvider.shareDir(MainActivity.this), safe);
                    try (FileOutputStream out = new FileOutputStream(f)) {
                        out.write(content.getBytes(StandardCharsets.UTF_8));
                    }
                    Uri uri = ShareProvider.uriFor(safe);
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                    i.putExtra(Intent.EXTRA_STREAM, uri);
                    i.putExtra(Intent.EXTRA_SUBJECT, safe);
                    if (text != null && !text.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, text);
                    i.setClipData(ClipData.newRawUri(safe, uri));
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(i, "Teilen").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Teilen nicht möglich", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void shareApk() {
            new Thread(() -> {
                try {
                    File src = new File(getApplicationInfo().sourceDir);
                    File dst = new File(ShareProvider.shareDir(MainActivity.this), "Schulplan.apk");
                    try (FileInputStream in = new FileInputStream(src); FileOutputStream out = new FileOutputStream(dst)) {
                        byte[] buf = new byte[65536];
                        int n;
                        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    }
                    runOnUiThread(() -> {
                        Uri uri = ShareProvider.uriFor("Schulplan.apk");
                        Intent i = new Intent(Intent.ACTION_SEND);
                        i.setType("application/vnd.android.package-archive");
                        i.putExtra(Intent.EXTRA_STREAM, uri);
                        i.putExtra(Intent.EXTRA_TEXT, "Schulplan – Organisations-App für Lehrkräfte. APK öffnen und installieren.");
                        i.setClipData(ClipData.newRawUri("Schulplan.apk", uri));
                        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(i, "App teilen").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
                    });
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "App konnte nicht geteilt werden", Toast.LENGTH_SHORT).show());
                }
            }).start();
        }

        @JavascriptInterface
        public void appReady() {
            runOnUiThread(() -> root.postDelayed(MainActivity.this::markReady, 60));
        }

        @JavascriptInterface
        public long versionCode() {
            return Updater.installedVersionCode(MainActivity.this);
        }

        @JavascriptInterface
        public void setUpdateUrls(String json) {
            Updater.setUrls(getApplicationContext(), json);
        }

        @JavascriptInterface
        public void checkUpdate(String reqId, String urlsJson) {
            new Thread(() -> {
                boolean ok = false;
                String out;
                try {
                    JSONArray a = new JSONArray(urlsJson);
                    String[] u = new String[a.length()];
                    for (int i = 0; i < a.length(); i++) u[i] = a.getString(i);
                    out = Updater.fetchInfo(u).toString();
                    ok = true;
                } catch (Exception e) {
                    out = String.valueOf(e.getMessage());
                }
                js("window.App && App.onUpdateInfo && App.onUpdateInfo(" + JSONObject.quote(reqId) + "," + ok + "," + JSONObject.quote(out) + ")");
            }).start();
        }

        @JavascriptInterface
        public void startUpdate(String apkUrl) {
            new Thread(() -> {
                try {
                    Updater.download(getApplicationContext(), apkUrl,
                            pct -> js("window.App && App.onUpdateProgress && App.onUpdateProgress(" + pct + ")"));
                    runOnUiThread(() -> {
                        boolean started = Updater.install(MainActivity.this);
                        js("window.App && App.onUpdateState && App.onUpdateState('" + (started ? "installing" : "permission") + "', '')");
                    });
                } catch (Exception e) {
                    js("window.App && App.onUpdateState && App.onUpdateState('error'," + JSONObject.quote(String.valueOf(e.getMessage())) + ")");
                }
            }).start();
        }

        @JavascriptInterface
        public boolean installDownloaded() {
            if (!Updater.apkFile(MainActivity.this).exists()) return false;
            runOnUiThread(() -> {
                boolean started = Updater.install(MainActivity.this);
                js("window.App && App.onUpdateState && App.onUpdateState('" + (started ? "installing" : "permission") + "', '')");
            });
            return true;
        }

        @JavascriptInterface
        public void updateWidgets(String json) {
            Widgets.save(getApplicationContext(), json);
        }

        @JavascriptInterface
        public String getIncoming() {
            String r = pendingIncoming;
            pendingIncoming = null;
            return r == null ? "" : r;
        }

        @JavascriptInterface
        public void syncPick(boolean create, String suggestedName) {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(create ? Intent.ACTION_CREATE_DOCUMENT : Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType(create ? "application/json" : "*/*");
                    if (create) i.putExtra(Intent.EXTRA_TITLE, suggestedName);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                    startActivityForResult(i, REQ_SYNC_PICK);
                } catch (Exception e) {
                    js("window.App && App.onSyncPicked && App.onSyncPicked(false, '')");
                }
            });
        }

        @JavascriptInterface
        public String syncInfo() {
            String u = prefs().getString("syncUri", "");
            if (u.isEmpty()) return "";
            try {
                JSONObject o = new JSONObject();
                o.put("uri", u);
                o.put("name", prefs().getString("syncName", "Team-Datei"));
                return o.toString();
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void syncClear() {
            String u = prefs().getString("syncUri", "");
            if (!u.isEmpty()) {
                try {
                    getContentResolver().releasePersistableUriPermission(Uri.parse(u),
                            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                } catch (Exception ignored) {
                }
            }
            prefs().edit().clear().apply();
        }

        @JavascriptInterface
        public void syncRead(String reqId) {
            String u = prefs().getString("syncUri", "");
            new Thread(() -> {
                boolean ok = false;
                String content = "";
                try {
                    if (!u.isEmpty()) {
                        content = readUri(Uri.parse(u));
                        ok = true;
                    }
                } catch (Exception e) {
                    content = String.valueOf(e.getMessage());
                }
                js("window.App && App.onSyncData && App.onSyncData(" + JSONObject.quote(reqId) + "," + ok + "," + JSONObject.quote(content) + ")");
            }).start();
        }

        @JavascriptInterface
        public void syncWrite(String reqId, String content) {
            String u = prefs().getString("syncUri", "");
            new Thread(() -> {
                boolean ok = false;
                try {
                    if (!u.isEmpty()) {
                        writeUri(Uri.parse(u), content);
                        ok = true;
                    }
                } catch (Exception ignored) {
                }
                js("window.App && App.onSyncWritten && App.onSyncWritten(" + JSONObject.quote(reqId) + "," + ok + ")");
            }).start();
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
                    getSharedPreferences("ui", MODE_PRIVATE).edit().putBoolean("dark", !lightBars).apply();
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
                    int c = Color.parseColor(color);
                    web.setBackgroundColor(c);
                    getWindow().setBackgroundDrawable(splash(c));
                    getSharedPreferences("ui", MODE_PRIVATE).edit().putInt("bg", c).apply();
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
        private int bottomInset = 0;

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

        void setInsets(int topPx, int bottomPx) {
            split = topPx;
            bottomInset = bottomPx;
            invalidateSelf();
        }

        @Override
        public void draw(Canvas canvas) {
            // Nur Status- und Navigationsleiste einfärben; die Mitte bleibt frei,
            // damit beim Laden der Startbildschirm (Fenster-Hintergrund) sichtbar ist.
            Rect r = getBounds();
            if (split > 0) canvas.drawRect(r.left, r.top, r.right, r.top + split, top);
            if (bottomInset > 0) canvas.drawRect(r.left, r.bottom - bottomInset, r.right, r.bottom, bottom);
        }

        @Override
        public void setAlpha(int alpha) {
        }

        @Override
        public void setColorFilter(ColorFilter colorFilter) {
        }

        @Override
        public int getOpacity() {
            return PixelFormat.TRANSLUCENT;
        }
    }
}
