export function readStoredJSON<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

export function writeStoredJSON<T>(key: string, value: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Ignore storage failures (private mode/quota), app should keep running.
    }
}

export function removeStoredItem(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        // Ignore storage failures.
    }
}
