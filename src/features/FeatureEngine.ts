/**
 * FeatureEngine - Calculates pose features and angles
 * Implements angle calculations, body line straightness, and velocity
 */

import {
  Pose,
  Keypoint,
  KeypointName,
  Features,
  FeatureConfig,
  AppError,
  ServiceResponse,
} from '../types';

export class FeatureEngine {
  private config: FeatureConfig;
  private previousFeatures: Features | null = null;
  private smoothingFactor: number;

  constructor(config?: Partial<FeatureConfig>) {
    this.config = {
      smoothingFactor: 0.1,
      stabilityWindowMs: 1000,
      motionThreshold: 5.0, // degrees per second
      angleCalculationMethod: 'atan2',
      ...config,
    };
    this.smoothingFactor = this.config.smoothingFactor;
  }

  /**
   * Calculate features from pose data
   */
  calculateFeatures(pose: Pose): ServiceResponse<Features> {
    try {
      const keypoints = pose.keypoints;
      
      // Calculate joint angles
      const angles = this.calculateJointAngles(keypoints);
      
      // Calculate body line straightness
      const bodyLineData = this.calculateBodyLineStraightness(keypoints);
      
      // Calculate body part positions
      const positions = this.calculateBodyPositions(keypoints);
      
      // Calculate velocities (if we have previous features)
      const velocity = this.calculateVelocities(angles, positions, bodyLineData.angle);
      
      // Calculate stability metrics
      const stability = this.calculateStability(velocity);
      
      // Calculate visibility metrics
      const visibility = this.calculateVisibility(keypoints);
      
      // Create features object
      const features: Features = {
        bodyLineAngle: bodyLineData.angle,
        bodyLineConfidence: bodyLineData.confidence,
        angles,
        positions,
        velocity,
        stability,
        visibility,
        timestamp: pose.timestamp,
        frameId: pose.frameId,
      };

      // Apply smoothing if enabled
      if (this.config.smoothingFactor > 0 && this.previousFeatures) {
        this.applySmoothing(features);
      }

      // Store for next calculation
      this.previousFeatures = { ...features };

      return {
        success: true,
        data: features,
        timestamp: Date.now(),
      };
    } catch (error) {
      const appError: AppError = {
        type: 'pose_estimation_failed',
        message: `Feature calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        recoverable: true,
        context: { originalError: error },
      };

      return {
        success: false,
        error: appError,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Calculate joint angles from keypoints
   */
  private calculateJointAngles(keypoints: Record<KeypointName, Keypoint>) {
    return {
      leftHip: this.calculateHipAngle(keypoints, 'left'),
      rightHip: this.calculateHipAngle(keypoints, 'right'),
      leftKnee: this.calculateKneeAngle(keypoints, 'left'),
      rightKnee: this.calculateKneeAngle(keypoints, 'right'),
      leftShoulder: this.calculateShoulderAngle(keypoints, 'left'),
      rightShoulder: this.calculateShoulderAngle(keypoints, 'right'),
      leftElbow: this.calculateElbowAngle(keypoints, 'left'),
      rightElbow: this.calculateElbowAngle(keypoints, 'right'),
      neck: this.calculateNeckAngle(keypoints),
    };
  }

  /**
   * Calculate hip angle (hip-knee-ankle)
   */
  private calculateHipAngle(keypoints: Record<KeypointName, Keypoint>, side: 'left' | 'right'): number {
    const hip = keypoints[`${side}_hip` as KeypointName];
    const knee = keypoints[`${side}_knee` as KeypointName];
    const ankle = keypoints[`${side}_ankle` as KeypointName];

    if (!this.areKeypointsVisible([hip, knee, ankle])) {
      return 0;
    }

    return this.calculateAngleBetweenVectors(
      { x: hip.x - knee.x, y: hip.y - knee.y },
      { x: ankle.x - knee.x, y: ankle.y - knee.y }
    );
  }

  /**
   * Calculate knee angle (hip-knee-ankle)
   */
  private calculateKneeAngle(keypoints: Record<KeypointName, Keypoint>, side: 'left' | 'right'): number {
    const hip = keypoints[`${side}_hip` as KeypointName];
    const knee = keypoints[`${side}_knee` as KeypointName];
    const ankle = keypoints[`${side}_ankle` as KeypointName];

    if (!this.areKeypointsVisible([hip, knee, ankle])) {
      return 0;
    }

    return this.calculateAngleBetweenVectors(
      { x: knee.x - hip.x, y: knee.y - hip.y },
      { x: knee.x - ankle.x, y: knee.y - ankle.y }
    );
  }

  /**
   * Calculate shoulder angle (hip-shoulder-elbow)
   */
  private calculateShoulderAngle(keypoints: Record<KeypointName, Keypoint>, side: 'left' | 'right'): number {
    const hip = keypoints[`${side}_hip` as KeypointName];
    const shoulder = keypoints[`${side}_shoulder` as KeypointName];
    const elbow = keypoints[`${side}_elbow` as KeypointName];

    if (!this.areKeypointsVisible([hip, shoulder, elbow])) {
      return 0;
    }

    return this.calculateAngleBetweenVectors(
      { x: shoulder.x - hip.x, y: shoulder.y - hip.y },
      { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y }
    );
  }

  /**
   * Calculate elbow angle (shoulder-elbow-wrist)
   */
  private calculateElbowAngle(keypoints: Record<KeypointName, Keypoint>, side: 'left' | 'right'): number {
    const shoulder = keypoints[`${side}_shoulder` as KeypointName];
    const elbow = keypoints[`${side}_elbow` as KeypointName];
    const wrist = keypoints[`${side}_wrist` as KeypointName];

    if (!this.areKeypointsVisible([shoulder, elbow, wrist])) {
      return 0;
    }

    return this.calculateAngleBetweenVectors(
      { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y },
      { x: elbow.x - wrist.x, y: elbow.y - wrist.y }
    );
  }

  /**
   * Calculate neck angle (ear-shoulder-hip)
   */
  private calculateNeckAngle(keypoints: Record<KeypointName, Keypoint>): number {
    const ear = keypoints.left_ear.confidence > keypoints.right_ear.confidence 
      ? keypoints.left_ear 
      : keypoints.right_ear;
    const shoulder = keypoints.left_shoulder.confidence > keypoints.right_shoulder.confidence 
      ? keypoints.left_shoulder 
      : keypoints.right_shoulder;
    const hip = keypoints.left_hip.confidence > keypoints.right_hip.confidence 
      ? keypoints.left_hip 
      : keypoints.right_hip;

    if (!this.areKeypointsVisible([ear, shoulder, hip])) {
      return 0;
    }

    return this.calculateAngleBetweenVectors(
      { x: shoulder.x - ear.x, y: shoulder.y - ear.y },
      { x: shoulder.x - hip.x, y: shoulder.y - hip.y }
    );
  }

  /**
   * Calculate body line straightness (shoulder-hip-ankle alignment)
   */
  private calculateBodyLineStraightness(keypoints: Record<KeypointName, Keypoint>) {
    // Try both sides, use the one with better visibility
    const leftSide = this.calculateBodyLineForSide(keypoints, 'left');
    const rightSide = this.calculateBodyLineForSide(keypoints, 'right');
    
    // Use the side with better confidence
    if (leftSide.confidence > rightSide.confidence) {
      return leftSide;
    }
    return rightSide;
  }

  /**
   * Calculate body line for a specific side
   */
  private calculateBodyLineForSide(keypoints: Record<KeypointName, Keypoint>, side: 'left' | 'right') {
    const shoulder = keypoints[`${side}_shoulder` as KeypointName];
    const hip = keypoints[`${side}_hip` as KeypointName];
    const ankle = keypoints[`${side}_ankle` as KeypointName];

    if (!this.areKeypointsVisible([shoulder, hip, ankle])) {
      return { angle: 0, confidence: 0 };
    }

    // Calculate angle from vertical (0° = perfectly straight)
    const dx = ankle.x - shoulder.x;
    const dy = ankle.y - shoulder.y;
    const angle = Math.atan2(dx, dy) * (180 / Math.PI);
    
    // Confidence based on keypoint visibility
    const confidence = (shoulder.confidence + hip.confidence + ankle.confidence) / 3;

    return { angle, confidence };
  }

  /**
   * Calculate body part positions relative to reference points
   */
  private calculateBodyPositions(keypoints: Record<KeypointName, Keypoint>) {
    // Use average of left/right for bilateral measurements
    const leftHip = keypoints.left_hip;
    const rightHip = keypoints.right_hip;
    const leftShoulder = keypoints.left_shoulder;
    const rightShoulder = keypoints.right_shoulder;
    const leftAnkle = keypoints.left_ankle;
    const rightAnkle = keypoints.right_ankle;

    // Calculate average positions
    const hipHeight = this.averageY([leftHip, rightHip]);
    const shoulderHeight = this.averageY([leftShoulder, rightShoulder]);
    const leftAnkleHeight = leftAnkle.confidence >= 0.6 ? leftAnkle.y : 0;
    const rightAnkleHeight = rightAnkle.confidence >= 0.6 ? rightAnkle.y : 0;

    // Head height (use ear as proxy)
    const leftEar = keypoints.left_ear;
    const rightEar = keypoints.right_ear;
    const headHeight = this.averageY([leftEar, rightEar]);

    return {
      hipHeight,
      shoulderHeight,
      headHeight,
      leftAnkleHeight,
      rightAnkleHeight,
    };
  }

  /**
   * Calculate velocities (change over time)
   */
  private calculateVelocities(angles: any, positions: any, bodyLineAngle: number) {
    if (!this.previousFeatures) {
      return {
        bodyLineAngle: 0,
        hipHeight: 0,
        shoulderHeight: 0,
      };
    }

    const timeDiff = (Date.now() - this.previousFeatures.timestamp) / 1000; // seconds
    if (timeDiff <= 0) {
      return {
        bodyLineAngle: 0,
        hipHeight: 0,
        shoulderHeight: 0,
      };
    }

    return {
      bodyLineAngle: (bodyLineAngle - this.previousFeatures.bodyLineAngle) / timeDiff,
      hipHeight: (positions.hipHeight - this.previousFeatures.positions.hipHeight) / timeDiff,
      shoulderHeight: (positions.shoulderHeight - this.previousFeatures.positions.shoulderHeight) / timeDiff,
    };
  }

  /**
   * Calculate stability metrics
   */
  private calculateStability(velocity: any) {
    const isMoving = Math.abs(velocity.bodyLineAngle) > this.config.motionThreshold ||
                    Math.abs(velocity.hipHeight) > this.config.motionThreshold ||
                    Math.abs(velocity.shoulderHeight) > this.config.motionThreshold;

    // Simple stability score based on velocity magnitude
    const maxVelocity = Math.max(
      Math.abs(velocity.bodyLineAngle),
      Math.abs(velocity.hipHeight),
      Math.abs(velocity.shoulderHeight)
    );
    const stabilityScore = Math.max(0, 1 - (maxVelocity / (this.config.motionThreshold * 2)));

    return {
      isStable: !isMoving,
      stabilityScore,
      motionGate: isMoving,
    };
  }

  /**
   * Calculate visibility metrics
   */
  private calculateVisibility(keypoints: Record<KeypointName, Keypoint>) {
    const keypointNames = Object.keys(keypoints) as KeypointName[];
    const visibleKeypoints = keypointNames.filter(
      name => keypoints[name].confidence >= 0.6
    );

    const overall = visibleKeypoints.length / keypointNames.length;

    // Critical points for different stretches (can be customized)
    const criticalPoints = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_ankle', 'right_ankle'];
    const criticalVisibility = criticalPoints.reduce((sum, point) => {
      return sum + (keypoints[point as KeypointName]?.confidence || 0);
    }, 0) / criticalPoints.length;

    return {
      overall,
      criticalPoints: {
        shoulders: (keypoints.left_shoulder.confidence + keypoints.right_shoulder.confidence) / 2,
        hips: (keypoints.left_hip.confidence + keypoints.right_hip.confidence) / 2,
        ankles: (keypoints.left_ankle.confidence + keypoints.right_ankle.confidence) / 2,
      },
      hasMinimumVisibility: overall >= 0.5,
    };
  }

  /**
   * Apply exponential moving average smoothing
   */
  private applySmoothing(features: Features) {
    if (!this.previousFeatures) return;

    const alpha = this.smoothingFactor;
    const prev = this.previousFeatures;

    // Smooth angles
    features.angles.leftHip = this.smoothValue(features.angles.leftHip, prev.angles.leftHip, alpha);
    features.angles.rightHip = this.smoothValue(features.angles.rightHip, prev.angles.rightHip, alpha);
    features.angles.leftKnee = this.smoothValue(features.angles.leftKnee, prev.angles.leftKnee, alpha);
    features.angles.rightKnee = this.smoothValue(features.angles.rightKnee, prev.angles.rightKnee, alpha);
    features.angles.leftShoulder = this.smoothValue(features.angles.leftShoulder, prev.angles.leftShoulder, alpha);
    features.angles.rightShoulder = this.smoothValue(features.angles.rightShoulder, prev.angles.rightShoulder, alpha);
    features.angles.leftElbow = this.smoothValue(features.angles.leftElbow, prev.angles.leftElbow, alpha);
    features.angles.rightElbow = this.smoothValue(features.angles.rightElbow, prev.angles.rightElbow, alpha);
    features.angles.neck = this.smoothValue(features.angles.neck, prev.angles.neck, alpha);

    // Smooth body line
    features.bodyLineAngle = this.smoothValue(features.bodyLineAngle, prev.bodyLineAngle, alpha);
  }

  /**
   * Smooth a value using exponential moving average
   */
  private smoothValue(current: number, previous: number, alpha: number): number {
    return alpha * current + (1 - alpha) * previous;
  }

  /**
   * Calculate angle between two vectors
   */
  private calculateAngleBetweenVectors(v1: { x: number; y: number }, v2: { x: number; y: number }): number {
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cosAngle = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    return angle * (180 / Math.PI);
  }

  /**
   * Check if keypoints are visible enough for calculations
   */
  private areKeypointsVisible(keypoints: Keypoint[]): boolean {
    return keypoints.every(kp => kp.confidence >= 0.6);
  }

  /**
   * Calculate average Y position of keypoints
   */
  private averageY(keypoints: Keypoint[]): number {
    const visible = keypoints.filter(kp => kp.confidence >= 0.6);
    if (visible.length === 0) return 0;
    
    const sum = visible.reduce((acc, kp) => acc + kp.y, 0);
    return sum / visible.length;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FeatureConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.smoothingFactor = this.config.smoothingFactor;
  }

  /**
   * Get current configuration
   */
  getConfig(): FeatureConfig {
    return { ...this.config };
  }

  /**
   * Reset previous features (useful for new sessions)
   */
  reset(): void {
    this.previousFeatures = null;
  }
}
