// Shared Resend throttle helper.
//
// Resend's free tier limits us to 2 requests per second. Parallel sends
// (Promise.all, etc.) will start returning 429s almost immediately. This
// helper serializes calls and enforces a minimum 600ms gap between them
// (~1.6 req/sec) across every caller in the same function invocation.
//
// Usage:
//   import { throttledResendSend } from '../_shared/resend-throttle.ts'
//   const { data, error } = await throttledResendSend(resend, {
//     from: VERSIONVAULT_FROM,
//     to: email,
//     subject,
//     html,
//   })
//
// The helper accepts the same payload shape as `resend.emails.send` and
// returns its result. If `resend` is null (dry-run mode), it resolves with
// `{ data: null, error: null }` without pacing.

// Minimum gap between Resend API calls, in milliseconds.
// Resend free tier = 2 req/sec, so 600ms gives us ~1.6/sec headroom.
export const RESEND_MIN_INTERVAL_MS = 600

// Module-scoped mutex chain. Each call appends its wait-then-send work
// to `pending`, so sends happen in strict FIFO order with ≥600ms spacing.
let pending: Promise<void> = Promise.resolve()
let lastSendAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Minimal shape we rely on from the Resend SDK. We avoid importing the
// Resend type here so this helper works with any version of the SDK.
interface ResendLike {
  emails: {
    send: (payload: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
  }
}

export async function throttledResendSend(
  resend: ResendLike | null,
  payload: Record<string, unknown>,
): Promise<{ data: unknown; error: unknown }> {
  if (!resend) {
    return { data: null, error: null }
  }

  // Chain onto the pending queue so callers serialize.
  let release: () => void = () => {}
  const mySlot = new Promise<void>((resolve) => {
    release = resolve
  })
  const prior = pending
  pending = pending.then(() => mySlot)

  try {
    await prior
    const now = Date.now()
    const wait = lastSendAt + RESEND_MIN_INTERVAL_MS - now
    if (wait > 0) {
      await sleep(wait)
    }
    lastSendAt = Date.now()
    return await resend.emails.send(payload)
  } finally {
    release()
  }
}
