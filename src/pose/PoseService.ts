/**
 * PoseService - Handles pose estimation using TF.js
 * Provides keypoint detection with confidence scores
 */

import * as tf from '@tensorflow/tfjs';
import {
  Pose,
  Keypoint,
  KeypointName,
  PoseConfig,
  AppError,
  ServiceResponse,
} from '../types';

// Type definitions for browser globals in React Native environment
declare const console: {
  error: (message?: unknown, ...optionalParams: unknown[]) => void;
};

// Image input types for pose estimation
type ImageInput = any; // Will be properly typed when integrating with actual camera

interface PoseNetConfig {
  architecture: 'MobileNetV1' | 'ResNet50';
  outputStride: 8 | 16 | 32;
  inputResolution: number;
  multiplier: 0.5 | 0.75 | 1.0 | 1.01;
  quantBytes: 1 | 2 | 4;
}

export interface PoseServiceConfig extends PoseConfig {
  modelUrl?: string;
  poseNetConfig?: PoseNetConfig;
  enableSmoothing: boolean;
  smoothingFactor: number;
  maxPoses: number;
  nmsRadius: number;
  scoreThreshold: number;
}

export interface PoseServiceState {
  isInitialized: boolean;
  isModelLoaded: boolean;
  isProcessing: boolean;
  lastInferenceTime: number;
  averageInferenceTime: number;
  totalInferences: number;
  error?: AppError | undefined;
}

export class PoseService {
  private model: tf.LayersModel | null = null;
  private config: PoseServiceConfig;
  private state: PoseServiceState;
  private poseCallbacks: Set<(pose: Pose) => void> = new Set();
  private errorCallbacks: Set<(error: AppError) => void> = new Set();
  private inferenceTimes: number[] = [];
  private readonly maxInferenceHistory = 10;

  // Keypoint name mapping from PoseNet to our KeypointName type
  private readonly keypointMapping: Record<string, KeypointName> = {
    nose: 'nose',
    leftEye: 'left_eye',
    rightEye: 'right_eye',
    leftEar: 'left_ear',
    rightEar: 'right_ear',
    leftShoulder: 'left_shoulder',
    rightShoulder: 'right_shoulder',
    leftElbow: 'left_elbow',
    rightElbow: 'right_elbow',
    leftWrist: 'left_wrist',
    rightWrist: 'right_wrist',
    leftHip: 'left_hip',
    rightHip: 'right_hip',
    leftKnee: 'left_knee',
    rightKnee: 'right_knee',
    leftAnkle: 'left_ankle',
    rightAnkle: 'right_ankle',
  };

  constructor(config?: Partial<PoseServiceConfig>) {
    this.config = {
      confidenceThreshold: 0.6,
      visibilityThreshold: 0.6,
      maxPoses: 1,
      enableSmoothing: true,
      smoothingFactor: 0.1,
      nmsRadius: 20,
      scoreThreshold: 0.3,
      modelUrl:
        'https://tfhub.dev/google/tfjs-model/posenet/mobilenet/float/050/1/default/1',
      poseNetConfig: {
        architecture: 'MobileNetV1',
        outputStride: 16,
        inputResolution: 257,
        multiplier: 0.5,
        quantBytes: 2,
      },
      ...config,
    };

    this.state = {
      isInitialized: false,
      isModelLoaded: false,
      isProcessing: false,
      lastInferenceTime: 0,
      averageInferenceTime: 0,
      totalInferences: 0,
    };
  }

  /**
   * Initialize the pose service and load the model
   */
  async initialize(): Promise<ServiceResponse<boolean>> {
    try {
      this.state.isInitialized = true;

      // Load the PoseNet model
      const loadResult = await this.loadModel();
      if (!loadResult.success) {
        return loadResult;
      }

      this.state.isModelLoaded = true;
      this.state.error = undefined;

      return {
        success: true,
        data: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      const appError: AppError = {
        type: 'pose_estimation_failed',
        message: `Pose service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        recoverable: true,
        context: { originalError: error },
      };

      this.state.error = appError;
      this.notifyError(appError);

      return {
        success: false,
        error: appError,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Load the TensorFlow.js PoseNet model
   */
  private async loadModel(): Promise<ServiceResponse<boolean>> {
    try {
      // Load PoseNet model
      this.model = await tf.loadLayersModel(this.config.modelUrl!);

      // Warm up the model with a dummy input
      const dummyInput = tf.zeros([
        1,
        this.config.poseNetConfig!.inputResolution,
        this.config.poseNetConfig!.inputResolution,
        3,
      ]);
      await this.model.predict(dummyInput);
      dummyInput.dispose();

      return {
        success: true,
        data: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      const appError: AppError = {
        type: 'pose_estimation_failed',
        message: `Failed to load pose model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        recoverable: true,
        context: { originalError: error, modelUrl: this.config.modelUrl },
      };

      this.state.error = appError;
      this.notifyError(appError);

      return {
        success: false,
        error: appError,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Estimate pose from image data
   */
  async estimatePose(imageData: ImageInput): Promise<ServiceResponse<Pose>> {
    if (!this.state.isModelLoaded || !this.model) {
      const error: AppError = {
        type: 'pose_estimation_failed',
        message: 'Pose model not loaded',
        timestamp: Date.now(),
        recoverable: true,
      };
      return { success: false, error, timestamp: Date.now() };
    }

    if (this.state.isProcessing) {
      const error: AppError = {
        type: 'pose_estimation_failed',
        message: 'Pose estimation already in progress',
        timestamp: Date.now(),
        recoverable: true,
      };
      return { success: false, error, timestamp: Date.now() };
    }

    try {
      this.state.isProcessing = true;
      const startTime = Date.now();

      // Convert image to tensor
      const imageTensor = tf.browser.fromPixels(imageData);
      const resizedImage = tf.image.resizeBilinear(imageTensor, [
        this.config.poseNetConfig!.inputResolution,
        this.config.poseNetConfig!.inputResolution,
      ]);
      const normalizedImage = resizedImage.div(255.0);
      const batchedImage = normalizedImage.expandDims(0);

      // Run pose estimation
      const predictions = (await this.model.predict(
        batchedImage
      )) as tf.Tensor[];

      // Process predictions to extract keypoints
      const keypoints = await this.processPredictions(
        predictions,
        imageData.width,
        imageData.height
      );

      // Calculate visibility score
      const visibilityScore = this.calculateVisibilityScore(keypoints);

      // Create pose object
      const pose: Pose = {
        keypoints,
        timestamp: Date.now(),
        frameId: this.generateFrameId(),
        visibilityScore,
      };

      // Clean up tensors
      imageTensor.dispose();
      resizedImage.dispose();
      normalizedImage.dispose();
      batchedImage.dispose();
      predictions.forEach(tensor => tensor.dispose());

      // Update performance metrics
      const inferenceTime = Date.now() - startTime;
      this.updatePerformanceMetrics(inferenceTime);

      this.state.isProcessing = false;
      this.state.lastInferenceTime = inferenceTime;

      // Notify callbacks
      this.poseCallbacks.forEach(callback => {
        try {
          callback(pose);
        } catch (error) {
          console.error('Error in pose callback:', error);
        }
      });

      return {
        success: true,
        data: pose,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.state.isProcessing = false;

      const appError: AppError = {
        type: 'pose_estimation_failed',
        message: `Pose estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        recoverable: true,
        context: { originalError: error },
      };

      this.state.error = appError;
      this.notifyError(appError);

      return {
        success: false,
        error: appError,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Process model predictions to extract keypoints
   */
  private async processPredictions(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _predictions: tf.Tensor[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _imageWidth: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _imageHeight: number
  ): Promise<Record<KeypointName, Keypoint>> {
    // This is a simplified implementation
    // In a real implementation, you would process the actual PoseNet output tensors
    const keypoints: Record<KeypointName, Keypoint> = {} as Record<
      KeypointName,
      Keypoint
    >;

    // Initialize all keypoints with default values
    const keypointNames: KeypointName[] = [
      'nose',
      'left_eye',
      'right_eye',
      'left_ear',
      'right_ear',
      'left_shoulder',
      'right_shoulder',
      'left_elbow',
      'right_elbow',
      'left_wrist',
      'right_wrist',
      'left_hip',
      'right_hip',
      'left_knee',
      'right_knee',
      'left_ankle',
      'right_ankle',
      'left_heel',
      'right_heel',
      'left_toe',
      'right_toe',
    ];

    keypointNames.forEach(name => {
      keypoints[name] = {
        x: 0,
        y: 0,
        confidence: 0,
        visibility: 'not_visible',
      };
    });

    // In a real implementation, you would:
    // 1. Extract keypoint coordinates from the prediction tensors
    // 2. Apply confidence thresholds
    // 3. Map PoseNet keypoint names to our KeypointName type
    // 4. Determine visibility based on confidence scores

    return keypoints;
  }

  /**
   * Calculate overall pose visibility score
   */
  private calculateVisibilityScore(
    keypoints: Record<KeypointName, Keypoint>
  ): number {
    const keypointNames = Object.keys(keypoints) as KeypointName[];
    const visibleKeypoints = keypointNames.filter(
      name => keypoints[name].confidence >= this.config.visibilityThreshold
    );

    return visibleKeypoints.length / keypointNames.length;
  }

  /**
   * Check if a keypoint is visible based on confidence threshold
   */
  private isKeypointVisible(confidence: number): boolean {
    return confidence >= this.config.visibilityThreshold;
  }

  /**
   * Determine keypoint visibility status
   */
  private getKeypointVisibility(
    confidence: number
  ): 'visible' | 'occluded' | 'not_visible' {
    if (confidence >= this.config.visibilityThreshold) {
      return 'visible';
    } else if (confidence >= this.config.confidenceThreshold) {
      return 'occluded';
    } else {
      return 'not_visible';
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(inferenceTime: number): void {
    this.inferenceTimes.push(inferenceTime);
    if (this.inferenceTimes.length > this.maxInferenceHistory) {
      this.inferenceTimes.shift();
    }

    this.state.averageInferenceTime =
      this.inferenceTimes.reduce((a, b) => a + b, 0) /
      this.inferenceTimes.length;
    this.state.totalInferences++;
  }

  /**
   * Add pose callback
   */
  addPoseCallback(callback: (pose: Pose) => void): void {
    this.poseCallbacks.add(callback);
  }

  /**
   * Remove pose callback
   */
  removePoseCallback(callback: (pose: Pose) => void): void {
    this.poseCallbacks.delete(callback);
  }

  /**
   * Add error callback
   */
  addErrorCallback(callback: (error: AppError) => void): void {
    this.errorCallbacks.add(callback);
  }

  /**
   * Remove error callback
   */
  removeErrorCallback(callback: (error: AppError) => void): void {
    this.errorCallbacks.delete(callback);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PoseServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current state
   */
  getState(): PoseServiceState {
    return { ...this.state };
  }

  /**
   * Get current configuration
   */
  getConfig(): PoseServiceConfig {
    return { ...this.config };
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return (
      this.state.isInitialized && this.state.isModelLoaded && !this.state.error
    );
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      lastInferenceTime: this.state.lastInferenceTime,
      averageInferenceTime: this.state.averageInferenceTime,
      totalInferences: this.state.totalInferences,
      isProcessing: this.state.isProcessing,
    };
  }

  /**
   * Generate unique frame ID
   */
  private generateFrameId(): string {
    return `pose_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notify error callbacks
   */
  private notifyError(error: AppError): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }

    this.poseCallbacks.clear();
    this.errorCallbacks.clear();
    this.inferenceTimes = [];
    this.state.isModelLoaded = false;
    this.state.isInitialized = false;
  }
}
