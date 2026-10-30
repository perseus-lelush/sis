/**
 * Desktop-only device gate logic.
 *
 * The app's UI is designed for laptop/desktop browsers and larger; phones,
 * tablets (including Android tablets) and other touch-only handhelds are
 * screened out by the DeviceGate component in client/src/components
 * and the pre-paint script in client/index.html.
 *
 * This module is intentionally DOM-free so it can be unit-tested directly
 * (see tests/helpers.test.mjs).
 */

/** Minimum viewport width (CSS px) accepted as a desktop window. */
export const MIN_DESKTOP_WIDTH = 1024;

/** User-agent markers for phones, tablets and other handheld devices. */
export const SMALL_DEVICE_UA_PATTERN =
  /android|iphone|ipod|ipad|iemobile|windows phone|opera mini|opera mobi|blackberry|bb10|webos|kindle|silk|fxios|\bmobi\b|\btablet\b|playbook|titan|nexus [5-9]/i;

/**
 * Decide whether a browser window may render the application.
 *
 * @param {{ width: number, userAgent: string, touchOnly: boolean }} input
 *   width: window.innerViewportWidth in CSS px
 *   userAgent: navigator.userAgent string
 *   touchOnly: true when the primary input is touch and there is no hover
 *              capability (matchMedia('(hover: none) and (pointer: coarse)'))
 * @returns {{ blocked: boolean, reasons: string[] }}
 *   reasons values: 'device' (user-agent), 'touch' (touch-only hardware),
 *   'viewport' (window narrower than MIN_DESKTOP_WIDTH), and 'unknown'
 *   (no browser profile available at all)
 */
export function inspectDevice({ width, userAgent, touchOnly }) {
  const reasons = [];

  // No way to verify a real browser profile: deny rather than allow.
  if (!Number.isFinite(width) && !userAgent) {
    return { blocked: true, reasons: ['unknown'] };
  }

  if (userAgent && SMALL_DEVICE_UA_PATTERN.test(userAgent)) {
    reasons.push('device');
  }
  if (touchOnly) {
    reasons.push('touch');
  }
  if (Number.isFinite(width) && width < MIN_DESKTOP_WIDTH) {
    reasons.push('viewport');
  }

  return { blocked: reasons.length > 0, reasons };
}
