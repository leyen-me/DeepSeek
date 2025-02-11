package com.example.va;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.os.Handler;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private boolean doubleBackToExitPressedOnce = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });

        // 
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(ContextCompat.getColor(this, R.color.status_bar_color));

        // 设置
        webView = findViewById(R.id.webView);

        WebChromeClient webChromeClient = new WebChromeClient();
        webView.setWebChromeClient(webChromeClient);
        webView.getSettings().setDomStorageEnabled(true); // 启用 DOM storage API
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setJavaScriptEnabled(true); // 启用 JavaScript
        webView.getSettings().setAllowFileAccessFromFileURLs(true); // 允许从文件 URL 访问资源
        webView.getSettings().setAllowUniversalAccessFromFileURLs(true); // 允许从文件 URL 访问全局变量
        webView.getSettings().setSupportZoom(true);
        webView.loadUrl("file:///android_asset/index.html");


        OnBackPressedCallback callback = new OnBackPressedCallback(true /* enabled by default */) {
            @Override
            public void handleOnBackPressed() {

                if (webView.canGoBack()) {
                    webView.goBack(); // 如果 WebView 可以返回，则执行 WebView 的后退操作
                } else {
                    if (doubleBackToExitPressedOnce) {
                        finish(); // 如果 doubleBackToExitPressedOnce 为 true，执行默认的返回操作（退出应用）
                    } else {
                        doubleBackToExitPressedOnce = true;
                        Toast.makeText(getApplicationContext(), "再按一次返回键退出应用", Toast.LENGTH_SHORT).show();

                        // 设置一个延迟，超过这个时间重置 doubleBackToExitPressedOnce
                        new Handler().postDelayed(() -> doubleBackToExitPressedOnce = false, 2000);
                    }
                }
            }
        };
        getOnBackPressedDispatcher().addCallback(this, callback);
    }
}