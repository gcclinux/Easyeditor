/**
 * Feature flags configuration
 * 
 * This file controls which features are enabled or disabled in the application.
 * Set a feature to `true` to enable it, or `false` to disable it.
 */



export const FEATURES = {
  // EasyNotes cloud integration feature
  // This feature is controlled by the license status.
  EASY_NOTES: true,

  // EasyTeam ephemeral chat feature
  EASY_TEAM: true,

  // Anonymous usage analytics (requires user opt-in consent via settings)
  ANALYTICS: true,

  // Add other feature flags here as needed
  // EXAMPLE_FEATURE: true,
} as const;

// Type for feature flag keys
export type FeatureFlag = keyof typeof FEATURES;

/**
 * Check if a feature is enabled
 * @param feature - The feature flag to check
 * @returns true if the feature is enabled, false otherwise
 */
export const isFeatureEnabled = (feature: FeatureFlag): boolean => {
  // If the feature is the EasyNotes feature, check for an active license.

  return FEATURES[feature];
};
