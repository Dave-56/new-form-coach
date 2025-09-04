/**
 * Type definitions for the Mobile Stretch Coach app
 * Central location for all TypeScript interfaces and types
 */

// TODO: Define KeypointName, Keypoint, Pose types
// TODO: Define Features, MotionBuffer types
// TODO: Define FSM event and configuration types
// TODO: Define Coach and TTS types

export interface Keypoint {
  x: number;
  y: number;
  confidence: number;
}

export interface Pose {
  keypoints: Keypoint[];
  timestamp: number;
}

// Placeholder types - will be expanded in Phase 2
export type KeypointName = string;
export type StretchType =
  | 'plank'
  | 'hamstring'
  | 'quad'
  | 'shoulder_cross'
  | 'calf';
export type FSMState =
  | 'WAITING'
  | 'READY'
  | 'HOLDING'
  | 'COACH_ISSUE'
  | 'COOLDOWN';
