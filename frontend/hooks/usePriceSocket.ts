"use client";

import { useEffect, useState } from "react";
import { getWsUrl } from "@/lib/api";

interface PriceSocketMessage {
  type: string;
  marketId?: string;
  data?: unknown;
  marketIds?: string[];
  error?: string;
}

export function usePriceSocket(marketIds: string[]) {
  const [lastMessage, setLastMessage] = useState<PriceSocketMessage | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "offline">("idle");

  useEffect(() => {
    if (marketIds.length === 0) return;

    let socket: WebSocket | null = null;
    let cancelled = false;

    try {
      setStatus("connecting");
      socket = new WebSocket(getWsUrl(marketIds));
      socket.onopen = () => {
        if (!cancelled) setStatus("live");
      };
      socket.onmessage = (event) => {
        if (cancelled) return;
        try {
          setLastMessage(JSON.parse(event.data) as PriceSocketMessage);
        } catch {
          setLastMessage({ type: "message", data: event.data });
        }
      };
      socket.onerror = () => {
        if (!cancelled) setStatus("offline");
      };
      socket.onclose = () => {
        if (!cancelled) setStatus("offline");
      };
    } catch {
      setStatus("offline");
    }

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [marketIds]);

  return { lastMessage, status };
}
