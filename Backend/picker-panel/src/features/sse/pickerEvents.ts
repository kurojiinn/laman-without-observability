import { env } from "../../shared/config/env";
import { getSession } from "../auth/sessionStore";

export type PickerEvent = {
  event: string;
  data: string;
};

type SubscribeOptions = {
  onEvent: (event: PickerEvent) => void;
  onError?: (error: Error) => void;
};

function parseSseChunk(chunk: string, emit: (event: PickerEvent) => void): void {
  const blocks = chunk.split("\n\n");
  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.replace("event:", "").trim();
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.replace("data:", "").trim());
      }
    }
    if (dataLines.length > 0) {
      emit({ event, data: dataLines.join("\n") });
    }
  }
}

export function subscribePickerEvents(options: SubscribeOptions): () => void {
  let active = true;
  let attempt = 0;
  let abortController: AbortController | null = null;

  const connect = async () => {
    while (active) {
      try {
        const token = getSession()?.token;
        if (!token) return;

        abortController = new AbortController();
        const response = await fetch(`${env.apiBaseUrl}/api/v1/picker/events`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE HTTP ${response.status}`);
        }

        attempt = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (active) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            parseSseChunk(part, options.onEvent);
          }
        }
      } catch (error) {
        if (!active) return;
        const err = error instanceof Error ? error : new Error("SSE connection error");
        options.onError?.(err);
        attempt += 1;
        const delays = [1_000, 2_000, 5_000, 10_000, 20_000];
        const delay = delays[Math.min(attempt - 1, delays.length - 1)];
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  };

  void connect();

  return () => {
    active = false;
    abortController?.abort();
  };
}
