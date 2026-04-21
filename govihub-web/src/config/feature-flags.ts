/**
 * Feature flags for GoviHub Spices
 *
 * Flip a flag to `true` and redeploy the frontend to enable the feature.
 * No backend changes required — these are compile-time constants that
 * tree-shake away the disabled code paths.
 */
export const FEATURES = {
  /** Show market-price cards on dashboards (enable when HARTI price feed is connected) */
  SHOW_MARKET_DATA: false,

  /** Embed the promo video on the /learn page (also needs NEXT_PUBLIC_PROMO_VIDEO_ID set) */
  SHOW_PROMO_VIDEO: false,

  /** Show advertisement carousel on dashboards */
  SHOW_ADS: true,
};
