import { useEffect, useRef, useCallback, useState } from "react";
import {
  CaptureUpdateAction,
  exportToBlob,
  exportToSvg,
} from "@excalidraw/excalidraw";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

const MCP_SERVER_URL =
  import.meta.env.VITE_MCP_SERVER_URL || "http://localhost:3003";
const MCP_WS_URL = MCP_SERVER_URL.replace(/^http/, "ws");
const RECONNECT_DELAY_MS = 3000;

interface ServerElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  roughness?: number;
  opacity?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string | number;
  label?: { text: string };
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  syncedAt?: string;
  source?: string;
  syncTimestamp?: string;
  boundElements?: any[] | null;
  containerId?: string | null;
  locked?: boolean;
  start?: { id: string };
  end?: { id: string };
  strokeStyle?: string;
  endArrowhead?: string;
  startArrowhead?: string;
  fillStyle?: string;
  roundness?: { type: number; value?: number } | null;
  points?: any;
  startBinding?: any;
  endBinding?: any;
  groupIds?: string[];
  elbowed?: boolean;
  [key: string]: any;
}

interface WsMessage {
  type: string;
  element?: ServerElement;
  elements?: ServerElement[];
  elementId?: string;
  count?: number;
  timestamp?: string;
  requestId?: string;
  format?: string;
  background?: boolean;
  scrollToContent?: boolean;
  scrollToElementId?: string;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  mermaidDiagram?: string;
  config?: any;
  [key: string]: any;
}

const cleanElement = (el: ServerElement): Record<string, any> => {
  const {
    createdAt,
    updatedAt,
    version,
    syncedAt,
    source,
    syncTimestamp,
    ...rest
  } = el;
  return { ...rest, version: 1 };
};

export default function McpBridge({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);
  const apiRef = useRef(excalidrawAPI);
  apiRef.current = excalidrawAPI;

  const postToMcp = useCallback(async (path: string, body: any) => {
    try {
      await fetch(`${MCP_SERVER_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error("[MCP Bridge] POST failed:", path, error);
    }
  }, []);

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      const api = apiRef.current;
      if (!api) {
        return;
      }

      const current = api.getSceneElements();

      try {
        switch (msg.type) {
          case "initial_elements": {
            if (!msg.elements?.length) {
              break;
            }
            const restored = restoreElements(
              msg.elements.map(cleanElement) as any,
              null,
              { repairBindings: true },
            );
            api.updateScene({
              elements: restored,
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
            break;
          }

          case "element_created": {
            if (!msg.element) {
              break;
            }
            const restored = restoreElements(
              [cleanElement(msg.element) as any],
              null,
              { repairBindings: true },
            );
            if (restored.length) {
              api.updateScene({
                elements: [...current, ...restored],
                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
              });
            }
            break;
          }

          case "element_updated": {
            if (!msg.element) {
              break;
            }
            const restored = restoreElements(
              [cleanElement(msg.element) as any],
              null,
            );
            if (restored.length) {
              api.updateScene({
                elements: current.map((el) =>
                  el.id === msg.element!.id ? restored[0] : el,
                ),
                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
              });
            }
            break;
          }

          case "element_deleted": {
            if (!msg.elementId) {
              break;
            }
            api.updateScene({
              elements: current.filter((el) => el.id !== msg.elementId),
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
            break;
          }

          case "elements_batch_created": {
            if (!msg.elements) {
              break;
            }
            const restored = restoreElements(
              msg.elements.map(cleanElement) as any,
              null,
              { repairBindings: true },
            );
            if (restored.length) {
              api.updateScene({
                elements: [...current, ...restored],
                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
              });
            }
            break;
          }

          case "canvas_cleared": {
            api.updateScene({
              elements: [],
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
            break;
          }

          case "export_image_request": {
            if (!msg.requestId) {
              break;
            }
            void (async () => {
              try {
                const elements = api.getSceneElements();
                const files = api.getFiles();
                const appState = {
                  ...api.getAppState(),
                  exportBackground: msg.background !== false,
                };

                if (msg.format === "svg") {
                  const svg = await exportToSvg({ elements, appState, files });
                  await postToMcp("/api/export/image/result", {
                    requestId: msg.requestId,
                    format: "svg",
                    data: new XMLSerializer().serializeToString(svg),
                  });
                  return;
                }

                const blob = await exportToBlob({
                  elements,
                  appState,
                  files,
                  mimeType: "image/png",
                });
                const reader = new FileReader();
                reader.onload = () => {
                  const base64 = (reader.result as string)?.split(",")[1];
                  if (base64) {
                    void postToMcp("/api/export/image/result", {
                      requestId: msg.requestId,
                      format: "png",
                      data: base64,
                    });
                  }
                };
                reader.readAsDataURL(blob);
              } catch (error: any) {
                console.error("[MCP Bridge] Export failed:", error);
                void postToMcp("/api/export/image/result", {
                  requestId: msg.requestId,
                  error: error.message,
                });
              }
            })();
            break;
          }

          case "set_viewport": {
            if (!msg.requestId) {
              break;
            }
            try {
              if (msg.scrollToContent) {
                const all = api.getSceneElements();
                if (all.length) {
                  api.scrollToContent(all, {
                    fitToViewport: true,
                    animate: true,
                  });
                }
              } else if (msg.scrollToElementId) {
                const target = api
                  .getSceneElements()
                  .find((el) => el.id === msg.scrollToElementId);
                if (!target) {
                  throw new Error(`Element ${msg.scrollToElementId} not found`);
                }
                api.scrollToContent([target], {
                  fitToViewport: false,
                  animate: true,
                });
              } else {
                const appState: any = {};
                if (msg.zoom !== undefined) {
                  appState.zoom = { value: msg.zoom };
                }
                if (msg.offsetX !== undefined) {
                  appState.scrollX = msg.offsetX;
                }
                if (msg.offsetY !== undefined) {
                  appState.scrollY = msg.offsetY;
                }
                if (Object.keys(appState).length) {
                  api.updateScene({ appState });
                }
              }
              void postToMcp("/api/viewport/result", {
                requestId: msg.requestId,
                success: true,
                message: "Viewport updated",
              });
            } catch (error: any) {
              console.error("[MCP Bridge] Viewport update failed:", error);
              void postToMcp("/api/viewport/result", {
                requestId: msg.requestId,
                error: error.message,
              });
            }
            break;
          }

          case "elements_synced":
          case "sync_status":
            break;

          default:
            break;
        }
      } catch (error) {
        console.error("[MCP Bridge] Failed to handle:", msg.type, error);
      }
    },
    [postToMcp],
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const scheduleReconnect = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    try {
      const ws = new WebSocket(MCP_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data) as WsMessage);
        } catch (error) {
          console.error("[MCP Bridge] Failed to parse message:", error);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => setConnected(false);
    } catch {
      scheduleReconnect();
    }
  }, [handleMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
    };
  }, [connect]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        left: 8,
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 6,
        background: connected
          ? "rgba(34, 197, 94, 0.15)"
          : "rgba(239, 68, 68, 0.15)",
        border: `1px solid ${
          connected ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"
        }`,
        fontSize: 12,
        color: connected ? "#16a34a" : "#dc2626",
        fontFamily: "system-ui, sans-serif",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: connected ? "#22c55e" : "#ef4444",
          display: "inline-block",
        }}
      />
      MCP {connected ? "Connected" : "Disconnected"}
    </div>
  );
}
