/**
 * CameraService - Handles camera operations and frame capture
 * Provides 8-12 FPS frame capture with ROI cropping functionality
 */

import { Camera } from 'expo-camera';
import { AppError, ServiceResponse } from '../types';

// Type definitions for Node.js globals in React Native environment
declare const setInterval: (callback: () => void, ms: number) => number;
declare const clearInterval: (id: number) => void;
declare const console: {
  error: (message?: unknown, ...optionalParams: unknown[]) => void;
};

export interface CameraFrame {
  uri: string;
  width: number;
  height: number;
  timestamp: number;
  frameId: string;
  base64?: string;
}

export interface CameraConfig {
  fps: {
    min: number;
    max: number;
    target: number;
  };
  resolution: {
    width: number;
    height: number;
  };
  roi?:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | undefined;
  enableCropping: boolean;
  enableBase64: boolean;
  quality: number; // 0-1
}

export interface CameraState {
  isActive: boolean;
  hasPermission: boolean;
  isInitialized: boolean;
  currentFPS: number;
  frameCount: number;
  lastFrameTime: number;
  error?: AppError | undefined;
}

export class CameraService {
  private camera: typeof Camera | null = null;
  private config: CameraConfig;
  private state: CameraState;
  private frameInterval: number | null = null;
  private frameIdCounter = 0;
  private lastFrameTime = 0;
  private frameCallbacks: Set<(frame: CameraFrame) => void> = new Set();
  private errorCallbacks: Set<(error: AppError) => void> = new Set();

  constructor(config?: Partial<CameraConfig>) {
    this.config = {
      fps: { min: 8, max: 12, target: 10 },
      resolution: { width: 640, height: 480 },
      enableCropping: false,
      enableBase64: false,
      quality: 0.8,
      ...config,
    };

    this.state = {
      isActive: false,
      hasPermission: false,
      isInitialized: false,
      currentFPS: 0,
      frameCount: 0,
      lastFrameTime: 0,
    };
  }

  /**
   * Initialize the camera service
   */
  async initialize(): Promise<ServiceResponse<boolean>> {
    try {
      // Request camera permissions
      const permissionResponse = await Camera.requestCameraPermissionsAsync();

      if (permissionResponse.status !== 'granted') {
        const error: AppError = {
          type: 'camera_permission_denied',
          message: 'Camera permission denied',
          timestamp: Date.now(),
          recoverable: true,
        };

        this.state.hasPermission = false;
        this.state.error = error;
        this.notifyError(error);

        return {
          success: false,
          error,
          timestamp: Date.now(),
        };
      }

      this.state.hasPermission = true;
      this.state.isInitialized = true;
      delete this.state.error;

      return {
        success: true,
        data: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      const appError: AppError = {
        type: 'camera_unavailable',
        message: `Camera initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
   * Start camera capture with specified FPS
   */
  async startCapture(): Promise<ServiceResponse<boolean>> {
    if (!this.state.hasPermission) {
      const error: AppError = {
        type: 'camera_permission_denied',
        message: 'Camera permission not granted',
        timestamp: Date.now(),
        recoverable: true,
      };
      return { success: false, error, timestamp: Date.now() };
    }

    if (this.state.isActive) {
      return { success: true, data: true, timestamp: Date.now() };
    }

    try {
      // Calculate frame interval based on target FPS
      const frameInterval = 1000 / this.config.fps.target;

      this.frameInterval = setInterval(() => {
        this.captureFrame();
      }, frameInterval);

      this.state.isActive = true;
      this.state.frameCount = 0;
      this.state.lastFrameTime = Date.now();

      return {
        success: true,
        data: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      const appError: AppError = {
        type: 'camera_unavailable',
        message: `Failed to start camera capture: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
   * Stop camera capture
   */
  async stopCapture(): Promise<ServiceResponse<boolean>> {
    if (!this.state.isActive) {
      return { success: true, data: true, timestamp: Date.now() };
    }

    try {
      if (this.frameInterval) {
        clearInterval(this.frameInterval);
        this.frameInterval = null;
      }

      this.state.isActive = false;
      this.state.currentFPS = 0;

      return {
        success: true,
        data: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      const appError: AppError = {
        type: 'camera_unavailable',
        message: `Failed to stop camera capture: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
   * Capture a single frame
   */
  private async captureFrame(): Promise<void> {
    if (!this.camera) {
      return;
    }

    try {
      const now = Date.now();
      const frameId = this.generateFrameId();

      // Calculate actual FPS
      if (this.state.frameCount > 0) {
        const timeDiff = now - this.state.lastFrameTime;
        this.state.currentFPS = 1000 / timeDiff;
      }

      // Create frame data
      const frame: CameraFrame = {
        uri: '', // Will be set by camera implementation
        width: this.config.resolution.width,
        height: this.config.resolution.height,
        timestamp: now,
        frameId,
      };

      // Apply ROI cropping if enabled
      if (this.config.enableCropping && this.config.roi) {
        frame.width = this.config.roi.width;
        frame.height = this.config.roi.height;
      }

      // Generate base64 if requested
      if (this.config.enableBase64) {
        // This would be implemented with actual camera capture
        // frame.base64 = await this.captureBase64();
      }

      this.state.frameCount++;
      this.state.lastFrameTime = now;

      // Notify all frame callbacks
      this.frameCallbacks.forEach(callback => {
        try {
          callback(frame);
        } catch (error) {
          console.error('Error in frame callback:', error);
        }
      });
    } catch (error) {
      const appError: AppError = {
        type: 'camera_unavailable',
        message: `Frame capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        recoverable: true,
        context: { originalError: error },
      };

      this.state.error = appError;
      this.notifyError(appError);
    }
  }

  /**
   * Set camera reference (called from React component)
   */
  setCameraRef(camera: typeof Camera | null): void {
    this.camera = camera;
  }

  /**
   * Update camera configuration
   */
  updateConfig(newConfig: Partial<CameraConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart capture if active and FPS changed
    if (this.state.isActive && newConfig.fps) {
      this.stopCapture().then(() => {
        this.startCapture();
      });
    }
  }

  /**
   * Set ROI (Region of Interest) for cropping
   */
  setROI(x: number, y: number, width: number, height: number): void {
    this.config.roi = { x, y, width, height };
    this.config.enableCropping = true;
  }

  /**
   * Clear ROI cropping
   */
  clearROI(): void {
    delete this.config.roi;
    this.config.enableCropping = false;
  }

  /**
   * Add frame callback
   */
  addFrameCallback(callback: (frame: CameraFrame) => void): void {
    this.frameCallbacks.add(callback);
  }

  /**
   * Remove frame callback
   */
  removeFrameCallback(callback: (frame: CameraFrame) => void): void {
    this.frameCallbacks.delete(callback);
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
   * Get current camera state
   */
  getState(): CameraState {
    return { ...this.state };
  }

  /**
   * Get current configuration
   */
  getConfig(): CameraConfig {
    return { ...this.config };
  }

  /**
   * Check if camera is ready
   */
  isReady(): boolean {
    return (
      this.state.isInitialized && this.state.hasPermission && !this.state.error
    );
  }

  /**
   * Generate unique frame ID
   */
  private generateFrameId(): string {
    return `frame_${Date.now()}_${++this.frameIdCounter}`;
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
    await this.stopCapture();
    this.frameCallbacks.clear();
    this.errorCallbacks.clear();
    this.camera = null;
    this.state.isInitialized = false;
  }
}
