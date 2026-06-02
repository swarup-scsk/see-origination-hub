// Lightweight persistence for workflow results so navigating between stages
// does not re-trigger the n8n/LLM calls. Browser localStorage, no DB.

export function loadJSON<T>(key: string): T | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJSON(key: string, value: unknown) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* ignore */
  }
}

export const SCAN_KEY = "see.scan.v1";
export const qualKey = (company: string) => `see.qual.v1.${company}`;
export const structKey = (company: string) => `see.struct.v1.${company}`;
export const priceKey = (company: string) => `see.price.v1.${company}`;
export const riskKey = (company: string) => `see.risk.v1.${company}`;
export const contractKey = (company: string) => `see.contract.v1.${company}`;
export const captureKey = (company: string) => `see.capture.v1.${company}`;
