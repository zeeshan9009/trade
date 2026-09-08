import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined" && !window.localStorage) {
  const store: Record<string, string> = {};
  const mockStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (idx: number) => Object.keys(store)[idx] ?? null,
    length: 0,
  };
  Object.defineProperty(window, "localStorage", { value: mockStorage });
}
if (typeof globalThis !== "undefined" && !(globalThis as unknown as { localStorage?: unknown }).localStorage) {
  const store: Record<string, string> = {};
  const mockStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (idx: number) => Object.keys(store)[idx] ?? null,
    length: 0,
  };
  Object.defineProperty(globalThis, "localStorage", { value: mockStorage });
}

