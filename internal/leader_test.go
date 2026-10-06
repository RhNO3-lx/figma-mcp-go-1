package internal

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// ── handlePing ────────────────────────────────────────────────────────────────

func TestLeaderHandlePing_OK(t *testing.T) {
	l := NewLeader(0, "v1.2.3")

	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	w := httptest.NewRecorder()
	l.handlePing(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("status = %q, want ok", body["status"])
	}
	if body["version"] != "v1.2.3" {
		t.Errorf("version = %q, want v1.2.3", body["version"])
	}
}

func TestLeaderHandlePing_MethodNotAllowed(t *testing.T) {
	l := NewLeader(0, "")

	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete} {
		req := httptest.NewRequest(method, "/ping", nil)
		w := httptest.NewRecorder()
		l.handlePing(w, req)

		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("%s /ping: status = %d, want 405", method, w.Code)
		}
	}
}

// ── handleRPC ─────────────────────────────────────────────────────────────────

func TestLeaderHandleRPC_MethodNotAllowed(t *testing.T) {
	l := NewLeader(0, "")

	req := httptest.NewRequest(http.MethodGet, "/rpc", nil)
	w := httptest.NewRecorder()
	l.handleRPC(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want 405", w.Code)
	}
}

func TestLeaderHandleRPC_InvalidJSON(t *testing.T) {
	l := NewLeader(0, "")

	req := httptest.NewRequest(http.MethodPost, "/rpc", bytes.NewBufferString("{bad json}"))
	w := httptest.NewRecorder()
	l.handleRPC(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
	var resp RPCResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Error == "" {
		t.Error("expected error in response body")
	}
}

func TestLeaderHandleRPC_ValidationError(t *testing.T) {
	l := NewLeader(0, "")

	// set_text with nodeId but missing text → validation error
	body, _ := json.Marshal(RPCRequest{
		Tool:    "set_text",
		NodeIDs: []string{"1:1"},
		Params:  map[string]any{},
	})
	req := httptest.NewRequest(http.MethodPost, "/rpc", bytes.NewReader(body))
	w := httptest.NewRecorder()
	l.handleRPC(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
	var resp RPCResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Error == "" {
		t.Error("expected validation error in response")
	}
}

func TestLeaderHandleRPC_BridgeNotConnected(t *testing.T) {
	l := NewLeader(0, "")

	// get_document has no required params — passes validation, hits bridge
	body, _ := json.Marshal(RPCRequest{Tool: "get_document"})
	req := httptest.NewRequest(http.MethodPost, "/rpc", bytes.NewReader(body))
	w := httptest.NewRecorder()
	l.handleRPC(w, req)

	// Bridge returns "plugin not connected" error → 200 with error field
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}
	var resp RPCResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Error == "" {
		t.Error("expected 'plugin not connected' error in response")
	}
}

// ── Start / Stop ──────────────────────────────────────────────────────────────

func TestLeaderStart_BindsPort(t *testing.T) {
	port := freePort(t)
	l := NewLeader(port, "")

	if err := l.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(l.Stop)

	// Second leader on the same port must fail.
	l2 := NewLeader(port, "")
	if err := l2.Start(); err == nil {
		l2.Stop()
		t.Error("expected error when binding already-used port")
	}
}

func TestLeaderStop_FreesPort(t *testing.T) {
	port := freePort(t)
	l := NewLeader(port, "")

	if err := l.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	l.Stop()

	// Allow OS to release the port.
	time.Sleep(20 * time.Millisecond)

	l2 := NewLeader(port, "")
	if err := l2.Start(); err != nil {
		t.Fatalf("port should be free after Stop: %v", err)
	}
	l2.Stop()
}

func TestLeaderStop_Idempotent(t *testing.T) {
	l := NewLeader(0, "")
	// Stop on a never-started leader should not panic.
	l.Stop()
	l.Stop()
}

// ── /ping endpoint (integration via httptest.Server) ─────────────────────────

func TestLeaderPingEndpoint(t *testing.T) {
	port := freePort(t)
	l := NewLeader(port, "test-ver")
	if err := l.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(l.Stop)

	f := NewFollower("http://localhost:" + itoa(port))
	if !f.Ping(t.Context()) {
		t.Error("expected ping to succeed for running leader")
	}
}

func TestLeaderRPCRejectsBrowserOrigins(t *testing.T) {
	leader := NewLeader(0, "desktop")
	for _, origin := range []string{"https://external.example", "http://localhost:1234", "null"} {
		t.Run(origin, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/rpc", bytes.NewBufferString(`{"tool":"get_metadata"}`))
			req.Header.Set("Origin", origin)
			recorder := httptest.NewRecorder()
			leader.handleRPC(recorder, req)
			if recorder.Code != http.StatusForbidden {
				t.Fatalf("browser RPC got status %d", recorder.Code)
			}
		})
	}
}
