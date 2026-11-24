//go:build windows

package main

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestListenLoopbackReusesPersistedPort(t *testing.T) {
	dataDir := t.TempDir()

	first, err := listenLoopback(dataDir)
	if err != nil {
		t.Fatalf("first listenLoopback() failed: %v", err)
	}
	firstAddr := first.Addr().(*net.TCPAddr)
	firstPort := firstAddr.Port
	if firstAddr.IP.String() != "127.0.0.1" {
		t.Fatalf("listener must bind only to 127.0.0.1, got %s", firstAddr.IP)
	}
	if err := first.Close(); err != nil {
		t.Fatalf("closing first listener: %v", err)
	}

	second, err := listenLoopback(dataDir)
	if err != nil {
		t.Fatalf("second listenLoopback() failed: %v", err)
	}
	defer second.Close()

	secondAddr := second.Addr().(*net.TCPAddr)
	if secondAddr.Port != firstPort {
		t.Fatalf("expected persisted port %d, got %d", firstPort, secondAddr.Port)
	}
	if secondAddr.IP.String() != "127.0.0.1" {
		t.Fatalf("listener must bind only to 127.0.0.1, got %s", secondAddr.IP)
	}
}

func TestListenLoopbackReplacesBusyPort(t *testing.T) {
	dataDir := t.TempDir()
	busy, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("creating busy test port: %v", err)
	}
	defer busy.Close()

	busyPort := busy.Addr().(*net.TCPAddr).Port
	portFile := filepath.Join(dataDir, "loopback-port.txt")
	if err := os.WriteFile(portFile, []byte(strconv.Itoa(busyPort)), 0600); err != nil {
		t.Fatalf("writing persisted test port: %v", err)
	}

	listener, err := listenLoopback(dataDir)
	if err != nil {
		t.Fatalf("listenLoopback() with a busy persisted port failed: %v", err)
	}
	defer listener.Close()

	newPort := listener.Addr().(*net.TCPAddr).Port
	if newPort == busyPort {
		t.Fatalf("expected a replacement port because %d is already in use", busyPort)
	}
	stored, err := os.ReadFile(portFile)
	if err != nil {
		t.Fatalf("reading replacement port file: %v", err)
	}
	if strings.TrimSpace(string(stored)) != fmt.Sprint(newPort) {
		t.Fatalf("expected port file to contain %d, got %q", newPort, strings.TrimSpace(string(stored)))
	}
	if listener.Addr().(*net.TCPAddr).IP.String() != "127.0.0.1" {
		t.Fatal("replacement listener must bind only to 127.0.0.1")
	}
}
