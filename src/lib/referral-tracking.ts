const STORAGE_KEY = 'vv_referral';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type StoredReferral = {
  code: string;
  capturedAt: number;
};

export function captureReferralFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('ref');
  if (!code) return;

  const entry: StoredReferral = { code, capturedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage may be full or disabled — silently ignore
  }
}

export function getStoredReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const entry: StoredReferral = JSON.parse(raw);
    if (Date.now() - entry.capturedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return entry.code;
  } catch {
    return null;
  }
}

export function clearStoredReferralCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
