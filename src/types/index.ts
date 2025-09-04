/**
 * Type definitions for the Mobile Stretch Coach app
 * Central location for all TypeScript interfaces and types
 */

// ============================================================================
// POSE ESTIMATION TYPES
// ============================================================================

/**
 * Human pose keypoint names as defined by pose estimation models
 * Based on COCO keypoints with additional foot keypoints
 */
export type KeypointName =
  // Face
  | 'nose'
  | 'left_eye'
  | 'right_eye'
  | 'left_ear'
  | 'right_ear'
  // Upper body
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_elbow'
  | 'right_elbow'
  | 'left_wrist'
  | 'right_wrist'
  // Torso
  | 'left_hip'
  | 'right_hip'
  // Lower body
  | 'left_knee'
  | 'right_knee'
  | 'left_ankle'
  | 'right_ankle'
  // Feet (additional keypoints for better foot tracking)
  | 'left_heel'
  | 'right_heel'
  | 'left_toe'
  | 'right_toe';

/**
 * Individual keypoint with position and confidence
 */
export interface Keypoint {
  x: number;
  y: number;
  confidence: number;
  visibility?: 'visible' | 'occluded' | 'not_visible';
}

/**
 * Complete pose estimation result
 */
export interface Pose {
  keypoints: Record<KeypointName, Keypoint>;
  timestamp: number;
  frameId: string;
  visibilityScore: number; // Overall pose visibility (0-1)
}

/**
 * Pose estimation service configuration
 */
export interface PoseConfig {
  confidenceThreshold: number;
  visibilityThreshold: number;
  maxPoses: number;
  enableSmoothing: boolean;
}

// ============================================================================
// FEATURE EXTRACTION TYPES
// ============================================================================

/**
 * Calculated pose features for coaching analysis
 */
export interface Features {
  // Body line straightness (degrees from vertical/horizontal)
  bodyLineAngle: number;
  bodyLineConfidence: number;

  // Joint angles (degrees)
  angles: {
    leftHip: number;
    rightHip: number;
    leftKnee: number;
    rightKnee: number;
    leftShoulder: number;
    rightShoulder: number;
    leftElbow: number;
    rightElbow: number;
    neck: number;
  };

  // Body part positions (relative to reference points)
  positions: {
    hipHeight: number;
    shoulderHeight: number;
    headHeight: number;
    leftAnkleHeight: number;
    rightAnkleHeight: number;
  };

  // Movement indicators
  velocity: {
    bodyLineAngle: number; // degrees per second
    hipHeight: number; // pixels per second
    shoulderHeight: number; // pixels per second
  };

  // Stability metrics
  stability: {
    isStable: boolean;
    stabilityScore: number; // 0-1, higher = more stable
    motionGate: boolean; // true if motion should suppress coaching
  };

  // Visibility status
  visibility: {
    overall: number; // 0-1
    criticalPoints: Record<string, number>; // visibility of key points for current stretch
    hasMinimumVisibility: boolean;
  };

  // Timestamp and metadata
  timestamp: number;
  frameId: string;
}

/**
 * Feature calculation configuration
 */
export interface FeatureConfig {
  smoothingFactor: number; // EMA smoothing factor (0-1)
  stabilityWindowMs: number; // Window for stability calculation
  motionThreshold: number; // Threshold for motion gating
  angleCalculationMethod: 'atan2' | 'acos' | 'asin';
}

// ============================================================================
// MOTION BUFFER TYPES
// ============================================================================

/**
 * Rolling buffer for motion data with smoothing
 */
export interface MotionBuffer {
  features: Features[];
  maxSize: number;
  currentSize: number;
  smoothingFactor: number;
}

/**
 * Buffer query result for stability analysis
 */
export interface BufferQuery {
  isStable: boolean;
  averageAngle: number;
  angleVariance: number;
  averageVelocity: number;
  stabilityScore: number;
  sampleCount: number;
  timeSpan: number; // milliseconds
}

/**
 * Motion buffer configuration
 */
export interface MotionBufferConfig {
  maxSize: number; // Maximum number of frames to store
  smoothingFactor: number; // EMA smoothing factor
  stabilityWindowMs: number; // Window for stability calculations
  medianFilterSize: number; // Size for median filtering
}

// ============================================================================
// FSM TYPES
// ============================================================================

/**
 * FSM states for stretch coaching
 */
export type FSMState =
  | 'WAITING' // Waiting for user to get into position
  | 'READY' // In position, ready to start holding
  | 'HOLDING' // Actively holding the stretch
  | 'COACH_ISSUE' // Issue detected, providing coaching
  | 'COOLDOWN'; // Cooling down after coaching

/**
 * FSM events that trigger state transitions
 */
export type FSMEvent =
  | 'POSE_DETECTED' // Pose detected in frame
  | 'POSE_LOST' // Pose lost or visibility too low
  | 'IN_POSITION' // User is in correct position
  | 'OUT_OF_POSITION' // User moved out of position
  | 'STABLE_HOLD' // User is holding position stably
  | 'ISSUE_DETECTED' // Form issue detected
  | 'ISSUE_RESOLVED' // Form issue resolved
  | 'COOLDOWN_COMPLETE' // Cooldown period finished
  | 'MOTION_DETECTED' // User is moving (suppress coaching)
  | 'MOTION_STOPPED'; // User stopped moving

/**
 * FSM state transition
 */
export interface FSMTransition {
  from: FSMState;
  to: FSMState;
  event: FSMEvent;
  condition?: (features: Features, config: StretchConfig) => boolean;
  cooldownMs?: number;
}

/**
 * FSM configuration for a specific stretch
 */
export interface StretchConfig {
  stretchType: StretchType;
  name: string;
  description: string;

  // Thresholds for form detection
  thresholds: {
    bodyLineAngle: {
      good: number; // ±degrees for good form
      warning: number; // ±degrees for warning
      critical: number; // ±degrees for critical issue
    };
    hipHeight?: {
      min: number;
      max: number;
    };
    kneeExtension?: {
      min: number; // minimum knee angle
      max: number; // maximum knee angle
    };
    shoulderRelaxation?: {
      max: number; // maximum shoulder elevation
    };
  };

  // Timing configuration
  timing: {
    stabilityWindowMs: number; // How long to wait for stability
    issueConfirmationMs: number; // How long issue must persist
    cooldownMs: number; // Cooldown after coaching
    motionGateMs: number; // How long to suppress after motion
  };

  // Required keypoints for this stretch
  requiredKeypoints: KeypointName[];
  minimumVisibility: number; // Minimum visibility score (0-1)

  // Hysteresis settings to prevent ping-ponging
  hysteresis: {
    bodyLineAngle: number; // Hysteresis band in degrees
    hipHeight?: number; // Hysteresis band in pixels
  };
}

/**
 * FSM state data
 */
export interface FSMStateData {
  currentState: FSMState;
  previousState: FSMState;
  stateStartTime: number;
  lastTransitionTime: number;
  lastEventTime: number;
  issueStartTime?: number;
  cooldownEndTime?: number;
  motionGateEndTime?: number;
  consecutiveIssues: number;
  totalIssues: number;
}

// ============================================================================
// COACHING TYPES
// ============================================================================

/**
 * Coaching cue types
 */
export type CueType =
  | 'position' // Get into position
  | 'adjustment' // Adjust current position
  | 'encouragement' // Positive reinforcement
  | 'reframe' // Camera framing issue
  | 'hold' // Hold current position
  | 'release'; // Release stretch

/**
 * Coaching cue severity levels
 */
export type CueSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Body side for side-specific cues
 */
export type BodySide = 'left' | 'right' | 'both';

/**
 * Individual coaching cue
 */
export interface CoachingCue {
  id: string;
  type: CueType;
  severity: CueSeverity;
  message: string;
  side?: BodySide;
  duration?: number; // Expected duration in seconds
  priority: number; // Higher number = higher priority
  cooldownMs: number; // Minimum time before this cue can repeat
  lastUsed?: number; // Timestamp of last use
}

/**
 * Coaching cue template for dynamic generation
 */
export interface CueTemplate {
  type: CueType;
  severity: CueSeverity;
  templates: {
    [key in BodySide]?: string[];
  };
  conditions: (features: Features, config: StretchConfig) => boolean;
  priority: number;
  cooldownMs: number;
}

/**
 * Coach service configuration
 */
export interface CoachConfig {
  enableLLM: boolean; // Whether to use LLM for dynamic cues
  llmEndpoint?: string;
  fallbackToCanned: boolean; // Fallback to canned cues if LLM fails
  maxCueLength: number; // Maximum cue length in characters
  cueCacheSize: number; // Number of cues to cache
  rateLimitMs: number; // Minimum time between cues
}

// ============================================================================
// SPEECH/TTS TYPES
// ============================================================================

/**
 * TTS service types
 */
export type TTSService = 'deepgram' | 'platform' | 'expo-av';

/**
 * Speech queue item
 */
export interface SpeechItem {
  id: string;
  text: string;
  priority: number;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Speech manager configuration
 */
export interface SpeechConfig {
  service: TTSService;
  rate: number; // Speech rate (0.1 - 2.0)
  pitch: number; // Speech pitch (0.1 - 2.0)
  volume: number; // Speech volume (0.0 - 1.0)
  queueSize: number; // Maximum queue size
  enableInterruption: boolean; // Allow interrupting current speech
  cooldownMs: number; // Minimum time between speech items
}

/**
 * Speech state
 */
export interface SpeechState {
  isPlaying: boolean;
  currentItem?: SpeechItem;
  queue: SpeechItem[];
  lastSpeechTime: number;
  isMuted: boolean;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

/**
 * Stretch types supported by the app
 */
export type StretchType =
  | 'plank'
  | 'hamstring'
  | 'quad'
  | 'shoulder_cross'
  | 'calf';

/**
 * Session state
 */
export type SessionState =
  | 'idle' // No active session
  | 'preparing' // Getting ready to start
  | 'active' // Active coaching session
  | 'paused' // Session paused
  | 'completed' // Session completed
  | 'error'; // Session error

/**
 * Individual stretch session
 */
export interface StretchSession {
  id: string;
  stretchType: StretchType;
  side?: BodySide; // For stretches that have left/right sides
  startTime: number;
  endTime?: number;
  duration: number; // Total duration in milliseconds
  issues: CoachingCue[]; // Issues detected during session
  totalIssues: number;
  averageStability: number; // Average stability score
  completionRate: number; // Percentage of time in good form
}

/**
 * Complete coaching session
 */
export interface CoachingSession {
  id: string;
  startTime: number;
  endTime?: number;
  state: SessionState;
  stretches: StretchSession[];
  currentStretch?: StretchSession;
  totalDuration: number;
  totalIssues: number;
  overallScore: number; // Overall session quality score
}

/**
 * Session configuration
 */
export interface SessionConfig {
  defaultStretchDuration: number; // Default duration per stretch in ms
  restDuration: number; // Rest between stretches in ms
  maxSessionDuration: number; // Maximum total session duration
  enableProgressTracking: boolean;
  autoAdvance: boolean; // Auto-advance to next stretch
}

// ============================================================================
// TELEMETRY TYPES
// ============================================================================

/**
 * Telemetry event types
 */
export type TelemetryEvent =
  | 'session_started'
  | 'session_completed'
  | 'stretch_started'
  | 'stretch_completed'
  | 'issue_detected'
  | 'issue_resolved'
  | 'cue_played'
  | 'pose_lost'
  | 'pose_regained'
  | 'error_occurred';

/**
 * Telemetry event data
 */
export interface TelemetryEventData {
  eventType: TelemetryEvent;
  timestamp: number;
  sessionId?: string;
  stretchId?: string;
  data: Record<string, unknown>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  frameRate: number; // Actual FPS achieved
  poseInferenceTime: number; // Average pose inference time in ms
  featureCalculationTime: number; // Average feature calculation time in ms
  cueResponseTime: number; // Time from issue detection to cue in ms
  memoryUsage: number; // Memory usage in MB
  batteryLevel?: number; // Battery level percentage
}

/**
 * User behavior metrics
 */
export interface UserMetrics {
  sessionDuration: number;
  totalIssues: number;
  averageStability: number;
  cueEffectiveness: number; // How quickly issues are resolved
  reframeRequests: number; // Number of times user needed to reframe
  completionRate: number; // Percentage of sessions completed
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * App error types
 */
export type AppErrorType =
  | 'camera_permission_denied'
  | 'camera_unavailable'
  | 'pose_estimation_failed'
  | 'tts_unavailable'
  | 'network_error'
  | 'storage_error'
  | 'unknown';

/**
 * Application error
 */
export interface AppError {
  type: AppErrorType;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  recoverable: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generic service response
 */
export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: AppError;
  timestamp: number;
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * App state for state management
 */
export interface AppState {
  session: CoachingSession | null;
  camera: {
    isActive: boolean;
    hasPermission: boolean;
    frameRate: number;
  };
  pose: {
    isDetecting: boolean;
    lastPose?: Pose;
    visibilityScore: number;
  };
  speech: SpeechState;
  errors: AppError[];
  isInitialized: boolean;
}
