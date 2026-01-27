export interface UiAnalyticsEvent {
  /** Short, action-style name, e.g. 'dashboard_section_viewed' */
  name: string;
  /** Logical area of the product, e.g. 'cv_screening_dashboard' */
  area?: string;
  /** Arbitrary extra context */
  metadata?: Record<string, any>;
}

/**
 * Lightweight UI analytics helper.
 *
 * - If a global analytics client is available (e.g. window.analytics, window.gtag, window.dataLayer),
 *   events will be forwarded there.
 * - Otherwise, events are logged to the console so we still have observability in dev.
 *
 * This keeps the React components clean while giving us flexible hooks
 * for measuring click depth, navigation, and completion rates.
 */
export class UiAnalyticsService {
  static track(event: UiAnalyticsEvent) {
    // Basic runtime guard so this never runs during SSR
    if (typeof window === 'undefined') return;

    const payload = {
      area: event.area ?? 'unknown',
      metadata: event.metadata ?? {},
      timestamp: new Date().toISOString(),
    };

    const name = event.name;
    const win = window as any;

    try {
      // Segment-style API
      if (win.analytics && typeof win.analytics.track === 'function') {
        win.analytics.track(name, payload);
        return;
      }

      // Google Analytics 4 / gtag
      if (typeof win.gtag === 'function') {
        win.gtag('event', name, payload);
        return;
      }

      // Generic dataLayer (e.g. GTM)
      if (Array.isArray(win.dataLayer)) {
        win.dataLayer.push({
          event: name,
          ...payload,
        });
        return;
      }

      // Fallback: console for dev / debugging
      // eslint-disable-next-line no-console
      console.debug('[UI Analytics]', name, payload);
    } catch (error) {
      // Never let analytics break the product experience
      // eslint-disable-next-line no-console
      console.warn('[UI Analytics] Failed to track event', name, error);
    }
  }
}

