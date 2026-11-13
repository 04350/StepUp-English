//go:build windows

package main

import (
	_ "embed"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"syscall"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
	"github.com/jchv/go-webview2/webviewloader"
)

// The complete learning application, including its audio data, is embedded
// directly into the Windows executable.
//
//go:embed app.html
var appHTML []byte

var (
	user32        = syscall.NewLazyDLL("user32.dll")
	procMessageBox = user32.NewProc("MessageBoxW")
)

func messageBox(title, message string) {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(message)
	procMessageBox.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x10)
}

func appDataDir() (string, error) {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		var err error
		base, err = os.UserConfigDir()
		if err != nil {
			return "", err
		}
	}
	dir := filepath.Join(base, "StepUpEnglish")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}

func main() {
	// WebView2 is an embedded Windows app component: it creates this app's
	// window and does not launch a separate Chrome/Edge browser window.
	version, err := webviewloader.GetInstalledVersion()
	if err != nil || version == "" {
		messageBox(
			"StepUp English",
			"לא נמצא רכיב Microsoft Edge WebView2 הנדרש להפעלת חלון התוכנה.\n\nב-Windows 11 הוא כלול בדרך כלל במערכת. במחשבים אחרים אפשר להתקין אותו פעם אחת באמצעות מתקין Microsoft WebView2 Runtime. לאחר ההתקנה ניתן להפעיל את StepUp English גם ללא אינטרנט.",
		)
		return
	}

	dataDir, err := appDataDir()
	if err != nil {
		messageBox("StepUp English", "לא ניתן להכין את תיקיית הנתונים המקומית.\n\n"+err.Error())
		return
	}
	profileDir := filepath.Join(dataDir, "WebView2")
	if err := os.MkdirAll(profileDir, 0700); err != nil {
		messageBox("StepUp English", "לא ניתן ליצור פרופיל מקומי לשמירת ההתקדמות.\n\n"+err.Error())
		return
	}

	// A loopback-only server gives the embedded page a stable local origin,
	// so its localStorage progress and settings persist between app launches.
	// It binds only to 127.0.0.1 and never exposes the app to the network.
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		messageBox("StepUp English", "לא ניתן להפעיל את סביבת התוכנה המקומית.\n\n"+err.Error())
		return
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && r.URL.Path != "/index.html" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write(appHTML)
	})
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 5_000_000_000}
	go func() {
		if serveErr := server.Serve(listener); serveErr != nil && serveErr != http.ErrServerClosed {
			log.Printf("local app server: %v", serveErr)
		}
	}()
	defer server.Close()

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     false,
		AutoFocus: true,
		DataPath:  profileDir,
		WindowOptions: webview2.WindowOptions{
			Title:  "StepUp English — לומדים אנגלית צעד צעד",
			Width:  1280,
			Height: 860,
			Center: true,
		},
	})
	if w == nil {
		messageBox("StepUp English", "לא ניתן ליצור את חלון התוכנה.\n\nודא ש-Microsoft WebView2 Runtime מותקן ועדכני.")
		return
	}
	defer w.Destroy()
	w.SetTitle("StepUp English — לומדים אנגלית צעד צעד")
	w.SetSize(1280, 860, webview2.HintNone)
	w.Navigate(fmt.Sprintf("http://127.0.0.1:%d/", listener.Addr().(*net.TCPAddr).Port))
	w.Run()
}
