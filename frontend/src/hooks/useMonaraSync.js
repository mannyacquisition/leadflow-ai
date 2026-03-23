/**
 * useMonaraSync — Gap 10.
 * Opens a WebSocket to /api/monara/ws/{userId} and pushes mutation events
 * to registered handlers so React components refresh without F5.
 */
import { useEffect, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";
const WS_BASE = API_BASE.replace(/^http/, "ws");

const _handlers = new Map(); // eventType → Set<callback>

export function useMonaraSync(userId) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (!userId) return;
    const url = `${WS_BASE}/api/monara/ws/${userId}`;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          const type = event.type;
          if (_handlers.has(type)) {
            _handlers.get(type).forEach((cb) => cb(event.payload));
          }
          // Wildcard handlers
          if (_handlers.has("*")) {
            _handlers.get("*").forEach((cb) => cb(event));
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        // Auto-reconnect after 3 seconds
        reconnectTimer.current = setTimeout(connect, 3000);
      };
    } catch { /* WebSocket not supported or blocked */ }
  }, [userId]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}

/** Register a handler for a specific mutation event type. */
export function onMonaraMutation(eventType, callback) {
  if (!_handlers.has(eventType)) _handlers.set(eventType, new Set());
  _handlers.get(eventType).add(callback);
  return () => _handlers.get(eventType)?.delete(callback);
}
