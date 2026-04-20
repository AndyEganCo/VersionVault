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
    console.log(`[Referral] Captured code from URL: ${code}`);
  } catch (err) {
    console.warn('[Referral] Failed to persist code to localStorage:', err);
  }
}

export function getStoredReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      console.log('[Referral] No stored code in localStorage');
      return null;
    }

    const entry: StoredReferral = JSON.parse(raw);
    const ageMin = Math.round((Date.now() - entry.capturedAt) / 60000);
    if (Date.now() - entry.capturedAt > TTL_MS) {
      console.log(`[Referral] Stored code ${entry.code} expired (age: ${ageMin}min), removing`);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    console.log(`[Referral] Read stored code: ${entry.code} (age: ${ageMin}min)`);
    return entry.code;
  } catch (err) {
    console.warn('[Referral] Failed to read localStorage:', err);
    return null;
  }
}

export function clearStoredReferralCode(): void {
  try {
    const had = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    if (had) console.log('[Referral] Cleared stored code');
  } catch {
    // ignore
  }
}
