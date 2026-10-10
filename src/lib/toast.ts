import toast from 'react-hot-toast';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

// Matches a leading run of emoji (surrogate pairs, dingbats, variation
// selectors). Written without the `u` regex flag so it compiles under the
// project's default TS target.
const LEADING_EMOJI_RE =
  /^(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D]+\s?)+/;
const ERROR_EMOJI_RE = /^(\u26A0\uFE0F?|\u274C|\u26D4|\uD83D\uDEAB)/; // ⚠️ ❌ ⛔ 🚫
const SUCCESS_EMOJI_RE =
  /^(\u2728|\u2705|\u2713|\uD83D\uDF89|\uD83D\uDCCB|\uD83D\uDD17|\uD83D\uDCBE)/; // ✨ ✅ ✓ 🎉 📋 🔗 💾
const ERROR_KEYWORDS_RE =
  /^(failed|error|could not|insufficient|invalid|denied|missing|unauthorized|not found)/i;

/**
 * App-wide toast helper, rendered top-center via the <Toaster /> in the root
 * layout. Drop-in replacement for the old per-page showToast implementations.
 *
 * Most call sites just do `showToast('...')`:
 * - A leading ⚠️/❌/⛔ emoji (or error keywords like "failed", "error",
 *   "insufficient") renders a red error toast.
 * - A leading ✨/✅/✓/🎉/📋/🔗 emoji renders a green success toast.
 * - Everything else renders a neutral toast.
 * Leading emoji are stripped since react-hot-toast provides its own icons.
 *
 * Pass an explicit kind to override the inference: `showToast(msg, 'error')`.
 */
export function showToast(message: string, kind?: ToastKind): string {
  const text = message.replace(LEADING_EMOJI_RE, '').trim() || message;

  let resolved = kind;
  if (!resolved) {
    if (ERROR_EMOJI_RE.test(message)) {
      resolved = 'error';
    } else if (ERROR_KEYWORDS_RE.test(text)) {
      resolved = 'error';
    } else if (SUCCESS_EMOJI_RE.test(message)) {
      resolved = 'success';
    }
  }

  switch (resolved) {
    case 'success':
      return toast.success(text);
    case 'error':
      return toast.error(text);
    case 'info':
      return toast(text, { icon: 'ℹ️' });
    case 'warning':
      return toast(text, { icon: '⚠️' });
    default:
      return toast(text);
  }
}

/** Dismiss all visible toasts. */
export function dismissToasts(): void {
  toast.dismiss();
}
