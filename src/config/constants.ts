/**
 * Application constants and configuration
 * Central location for all app-wide constants
 */

// Performance targets
export const PERFORMANCE_TARGETS = {
  CAMERA_FPS: { MIN: 8, MAX: 12 },
  POSE_INFERENCE_MS: {
    NATIVE: { MIN: 40, MAX: 80 },
    TFJS: { MIN: 80, MAX: 150 },
  },
  END_TO_SPEECH_MS: { MAX: 800 },
} as const;

// Pose estimation
export const POSE_CONFIG = {
  CONFIDENCE_THRESHOLD: 0.6,
  VISIBILITY_THRESHOLD: 0.6,
} as const;

// FSM states
export const FSM_STATES = {
  WAITING: 'WAITING',
  READY: 'READY',
  HOLDING: 'HOLDING',
  COACH_ISSUE: 'COACH_ISSUE',
  COOLDOWN: 'COOLDOWN',
} as const;

// Stretch types
export const STRETCH_TYPES = {
  PLANK: 'plank',
  HAMSTRING: 'hamstring',
  QUAD: 'quad',
  SHOULDER_CROSS: 'shoulder_cross',
  CALF: 'calf',
} as const;

// UI constants
export const UI_CONSTANTS = {
  STATUS_COLORS: {
    GOOD: '#4CAF50',
    ADJUST: '#FF9800',
    ERROR: '#F44336',
  },
} as const;
