import { env } from "../config/env";
import { getSession, logout } from "../../features/auth/sessionStore";
import { ApiError, type ApiErrorPayload } from "./types";

function buildUrl(path: string): string {
  return `${env.apiBaseUrl}${path}`;
}

async function readPayload(response: Response): Promise<ApiErrorPayload | undefined> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return undefined;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  authorized?: boolean;
  signal?: AbortSignal;
};

export async function httpRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.authorized) {
    const token = getSession()?.token;
    if (!token) {
      throw new ApiError("Сессия отсутствует", 401);
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    const payload = await readPayload(response);
    const message = payload?.error ?? payload?.message ?? `HTTP ${response.status}`;
    if (response.status === 401) {
      logout();
    }
    throw new ApiError(message, response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
