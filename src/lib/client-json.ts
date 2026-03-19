"use client";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function fetchJsonSafe<T>(
  url: string,
  validate: (data: unknown) => data is T,
  fallback: T
): Promise<T> {
  try {
    const response = await fetch(url);
    const data = await response.json().catch(() => null);
    if (!response.ok || !validate(data)) {
      return fallback;
    }
    return data;
  } catch {
    return fallback;
  }
}
