/**
 * Adaptive video constraints for camera/getUserMedia.
 * Lower resolution (640×480 desktop) keeps file size small for interview recordings
 * and faster uploads. Mobile uses same 640×480.
 */
const MOBILE_BREAKPOINT = 768;
const DESKTOP_IDEAL = { width: 640, height: 480 };
const MOBILE_IDEAL = { width: 640, height: 480 };

export type AdaptiveVideoOptions = {
  /** Force mobile-style constraints (lower resolution) */
  preferMobile?: boolean;
  /** Prefer front camera (e.g. for selfie/candidate view on phones) */
  preferFrontCamera?: boolean;
};

/**
 * Returns video constraints suitable for getUserMedia. Uses ideal/max so
 * devices can negotiate; on narrow screens or when preferMobile is true,
 * uses lower ideals so phones don't fail.
 */
export function getAdaptiveVideoConstraints(
  options: AdaptiveVideoOptions = {}
): MediaTrackConstraints {
  const { preferMobile = false, preferFrontCamera = false } = options;
  const isNarrow =
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;
  const useMobilePreset = preferMobile || isNarrow;

  const ideal = useMobilePreset ? MOBILE_IDEAL : DESKTOP_IDEAL;
  const max = useMobilePreset ? MOBILE_IDEAL : DESKTOP_IDEAL;

  const constraints: MediaTrackConstraints = {
    width: { ideal: ideal.width, max: max.width },
    height: { ideal: ideal.height, max: max.height },
  };

  if (preferFrontCamera) {
    constraints.facingMode = { ideal: 'user' };
  }

  // Optional: respect getSupportedConstraints so we don't request unsupported props
  if (
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices?.getSupportedConstraints
  ) {
    const supported = navigator.mediaDevices.getSupportedConstraints();
    const out: MediaTrackConstraints = {};
    if (supported.width && constraints.width) out.width = constraints.width;
    if (supported.height && constraints.height) out.height = constraints.height;
    if (supported.facingMode && constraints.facingMode)
      out.facingMode = constraints.facingMode;
    if (Object.keys(out).length > 0) return out;
  }

  return constraints;
}
