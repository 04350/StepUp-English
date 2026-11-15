package com.stepupenglish.app

import android.Manifest
import android.app.Activity
import android.content.ContentValues
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import java.io.File
import java.io.FileOutputStream

class MainActivity : Activity() {
    companion object {
        private const val TAG = "StepUpEnglish"
        private const val FILE_PICKER_REQUEST = 4101
        private const val STORAGE_PERMISSION_REQUEST = 4102
        private const val START_PAGE = "file:///android_asset/index.html"
    }

    private lateinit var webView: WebView
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var pendingExport: Pair<String, ByteArray>? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.rgb(245, 246, 251)
        window.navigationBarColor = Color.rgb(245, 246, 251)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            window.decorView.systemUiVisibility =
                window.decorView.systemUiVisibility or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }

        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(245, 246, 251))
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                allowFileAccessFromFileURLs = true
                allowUniversalAccessFromFileURLs = false
                loadsImagesAutomatically = true
                mediaPlaybackRequiresUserGesture = false
                javaScriptCanOpenWindowsAutomatically = false
                mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }
            addJavascriptInterface(NativeFileBridge(), "StepUpNative")
            webChromeClient = StepUpChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    val scheme = request.url.scheme?.lowercase()
                    // The learning app is packaged locally. Block external navigation so
                    // the Android app remains offline and cannot unexpectedly leave the app.
                    return scheme !in setOf("file", "data", "blob", "about")
                }

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    installOfflineDownloadBridge(view)
                }
            }
        }

        setContentView(webView)
        if (savedInstanceState == null) {
            webView.loadUrl(START_PAGE)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    private fun installOfflineDownloadBridge(view: WebView) {
        val script = """
            (function () {
              if (window.__stepUpNativeDownloadBridge) return;
              window.__stepUpNativeDownloadBridge = true;
              document.addEventListener('click', function (event) {
                var link = event.target && event.target.closest
                  ? event.target.closest('a[download]') : null;
                if (!link) return;
                var href = link.href || '';
                if (!href.startsWith('blob:') && !href.startsWith('data:')) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                fetch(href).then(function (response) { return response.blob(); })
                  .then(function (blob) {
                    var reader = new FileReader();
                    reader.onloadend = function () {
                      if (window.StepUpNative) {
                        window.StepUpNative.saveFile(
                          link.getAttribute('download') || 'StepUp-English-backup.json',
                          String(reader.result || '')
                        );
                      }
                    };
                    reader.readAsDataURL(blob);
                  })
                  .catch(function (error) { console.error('Backup export failed', error); });
              }, true);
            })();
        """.trimIndent()
        view.evaluateJavascript(script, null)
    }

    inner class NativeFileBridge {
        @JavascriptInterface
        fun saveFile(fileName: String, dataUrl: String) {
            try {
                val encoded = dataUrl.substringAfter(',', "")
                if (encoded.isBlank()) {
                    showToast("לא ניתן לקרוא את קובץ הגיבוי")
                    return
                }
                val bytes = Base64.decode(encoded, Base64.DEFAULT)
                val safeName = fileName
                    .replace(Regex("[\\\\/:*?\"<>|]"), "_")
                    .take(120)
                    .ifBlank { "StepUp-English-backup.json" }

                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
                    checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
                    PackageManager.PERMISSION_GRANTED
                ) {
                    pendingExport = safeName to bytes
                    requestPermissions(
                        arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE),
                        STORAGE_PERMISSION_REQUEST
                    )
                } else {
                    saveExport(safeName, bytes)
                }
            } catch (error: Exception) {
                Log.e(TAG, "Unable to save exported backup", error)
                showToast("שמירת הקובץ נכשלה")
            }
        }
    }

    private fun saveExport(fileName: String, bytes: ByteArray) {
        Thread {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                        put(MediaStore.Downloads.MIME_TYPE, "application/octet-stream")
                        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/StepUp English")
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        ?: throw IllegalStateException("Could not create Downloads entry")
                    contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                        ?: throw IllegalStateException("Could not open Downloads entry")
                    val done = ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }
                    contentResolver.update(uri, done, null, null)
                } else {
                    @Suppress("DEPRECATION")
                    val directory = File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                        "StepUp English"
                    )
                    if (!directory.exists() && !directory.mkdirs()) {
                        throw IllegalStateException("Could not create Downloads folder")
                    }
                    FileOutputStream(File(directory, fileName)).use { it.write(bytes) }
                }
                showToast("קובץ הגיבוי נשמר בתיקיית ההורדות")
            } catch (error: Exception) {
                Log.e(TAG, "Export save failed", error)
                showToast("לא הצלחנו לשמור את קובץ הגיבוי")
            }
        }.start()
    }

    private fun showToast(message: String) {
        runOnUiThread {
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        }
    }

    private inner class StepUpChromeClient : WebChromeClient() {
        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams
        ): Boolean {
            this@MainActivity.fileChooserCallback?.onReceiveValue(null)
            this@MainActivity.fileChooserCallback = filePathCallback
            return try {
                startActivityForResult(fileChooserParams.createIntent(), FILE_PICKER_REQUEST)
                true
            } catch (error: Exception) {
                Log.e(TAG, "Unable to open file picker", error)
                this@MainActivity.fileChooserCallback = null
                filePathCallback.onReceiveValue(null)
                false
            }
        }

        override fun onConsoleMessage(message: android.webkit.ConsoleMessage): Boolean {
            Log.d(TAG, "JS: ${message.message()} -- ${message.sourceId()}:${message.lineNumber()}")
            return true
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_PICKER_REQUEST) {
            val result = if (resultCode == RESULT_OK && data != null) {
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } else {
                null
            }
            fileChooserCallback?.onReceiveValue(result)
            fileChooserCallback = null
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == STORAGE_PERMISSION_REQUEST) {
            val export = pendingExport
            pendingExport = null
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED && export != null) {
                saveExport(export.first, export.second)
            } else {
                showToast("לא ניתנה הרשאה לשמירת קובץ הגיבוי")
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated in Android API, kept for broad device compatibility")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.apply {
                stopLoading()
                loadUrl("about:blank")
                clearHistory()
                removeAllViews()
                destroy()
            }
        }
        super.onDestroy()
    }
}
