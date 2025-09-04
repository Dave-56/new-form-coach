# Mobile Stretch Coach - Implementation Plan

## Project Overview

A React Native + Expo mobile app that provides real-time form coaching for stretching exercises using on-device pose estimation and voice feedback.

## Technology Stack

- **Framework**: React Native + Expo
- **Development**: Expo Go (prototyping) → Expo Dev Client (production)
- **Pose Estimation**: TF.js (dev) → Native pose lib (prod)
- **TTS**: Deepgram or platform TTS
- **Language**: TypeScript

---

## Phase 1: Project Setup & Foundation (Week 1)

### 1.1 Initial Project Setup

- [ ] Create new Expo project with TypeScript
- [ ] Set up project structure according to specification
- [ ] Configure ESLint, Prettier, and TypeScript settings
- [ ] Set up Git repository and initial commit

### 1.2 Core Dependencies Installation

- [ ] Install expo-camera for camera functionality
- [ ] Install @tensorflow/tfjs for pose estimation (dev)
- [ ] Install expo-av for audio/TTS
- [ ] Install required navigation libraries
- [ ] Install state management (Zustand or Redux)

### 1.3 Project Structure Setup

```
/src
  /camera/CameraService.ts
  /pose/PoseService.ts
  /features/FeatureEngine.ts
  /motion/MotionBuffer.ts
  /fsm/StretchFSM.ts
  /fsm/config/
    plank.ts
    hamstring.ts
    quad.ts
    shoulder_cross.ts
    calf.ts
  /coach/CoachService.ts
  /speech/SpeechManager.ts
  /session/SessionController.ts
  /telemetry/MetricsService.ts
  /ui/screens/
    HomeScreen.tsx
    SessionScreen.tsx
  /ui/components/
    CameraPreview.tsx
    StatusBanner.tsx
    StretchSelector.tsx
  /types/
    index.ts
  /config/
    constants.ts
```

---

## Phase 2: Core Services Implementation (Week 2-3)

### 2.1 Type Definitions

- [ ] Define KeypointName, Keypoint, Pose types
- [ ] Define Features, MotionBuffer types
- [ ] Define FSM event and configuration types
- [ ] Define Coach and TTS types

### 2.2 Camera Service

- [ ] Implement CameraService class
- [ ] Set up 8-12 FPS frame capture
- [ ] Implement ROI cropping functionality
- [ ] Add frame timestamp and ID generation
- [ ] Test camera permissions and error handling

### 2.3 Pose Service

- [ ] Implement PoseService with TF.js integration
- [ ] Add keypoint detection with confidence scores
- [ ] Implement visibility detection (conf >= 0.6)
- [ ] Add error handling for pose estimation failures
- [ ] Create interface for future native pose integration

### 2.4 Feature Engine

- [ ] Implement angle calculations (hip, knee, shoulder, neck)
- [ ] Add body line straightness computation
- [ ] Implement velocity calculations (dangle/dt)
- [ ] Add partial visibility handling
- [ ] Create fallback computations for missing keypoints

### 2.5 Motion Buffer

- [ ] Implement rolling buffer (1-2 seconds)
- [ ] Add EMA smoothing for angles
- [ ] Implement median filter for visibility
- [ ] Add stability window queries
- [ ] Test buffer performance and memory usage

---

## Phase 3: FSM System Implementation (Week 4)

### 3.1 Generic FSM Engine

- [ ] Implement StretchFSM base class
- [ ] Add state management (WAITING → READY → HOLDING → COACH_ISSUE → COOLDOWN)
- [ ] Implement hysteresis logic
- [ ] Add cooldown mechanisms
- [ ] Create motion gating (suppress cues while moving)

### 3.2 Stretch-Specific Configurations

- [ ] **Plank Configuration**
  - [ ] Body line thresholds (±6° OK, ±9° issue)
  - [ ] Hip sag/high detection
  - [ ] Neck neutrality checks
  - [ ] Motion gate settings
- [ ] **Hamstring Configuration**
  - [ ] Knee straightness detection
  - [ ] Back neutrality checks
  - [ ] Hip squareness validation
- [ ] **Quad Configuration**
  - [ ] Knee extension monitoring
  - [ ] Pelvis tuck detection
  - [ ] Rib position checks
- [ ] **Shoulder Cross Configuration**
  - [ ] Shoulder relaxation detection
  - [ ] Elbow height monitoring
  - [ ] Torso forward position
- [ ] **Calf Configuration**
  - [ ] Heel down detection
  - [ ] Toe forward alignment
  - [ ] Knee straightness (if applicable)

### 3.3 Event System

- [ ] Implement EventBus for FSM events
- [ ] Add event deduplication
- [ ] Implement rate limiting
- [ ] Add event logging for debugging

---

## Phase 4: Coaching & Voice System (Week 5)

### 4.1 Coach Service

- [ ] Implement CoachService for cue generation
- [ ] Add LLM integration for dynamic cues
- [ ] Create canned cue fallbacks
- [ ] Implement cue caching system
- [ ] Add severity-based cue selection

### 4.2 Speech Manager

- [ ] Implement SpeechManager with queue system
- [ ] Add TTS integration (Deepgram/platform)
- [ ] Implement cooldown mechanisms
- [ ] Add priority-based queue management
- [ ] Create speech interruption handling

### 4.3 Cue Content

- [ ] Create cue templates for each issue type
- [ ] Add severity-based variations
- [ ] Implement side-specific cues (left/right)
- [ ] Add duration-based cue variations

---

## Phase 5: UI Implementation (Week 6)

### 5.1 Core Screens

- [ ] **HomeScreen**
  - [ ] Stretch selection interface
  - [ ] User onboarding flow
  - [ ] Settings access
- [ ] **SessionScreen**
  - [ ] Camera preview display
  - [ ] Status banner (Good/Adjust)
  - [ ] Timer display
  - [ ] Keypoint overlay (optional)

### 5.2 UI Components

- [ ] **CameraPreview**
  - [ ] Camera view with overlay
  - [ ] Keypoint visualization
  - [ ] Frame rate indicator
- [ ] **StatusBanner**
  - [ ] Traffic light system
  - [ ] Current status display
  - [ ] Last cue display
- [ ] **StretchSelector**
  - [ ] Stretch type selection
  - [ ] Difficulty levels
  - [ ] Instructions preview

### 5.3 Visual Feedback

- [ ] Implement keypoint skeleton overlay
- [ ] Add real-time angle displays
- [ ] Create progress indicators
- [ ] Add accessibility features

---

## Phase 6: Session Management (Week 7)

### 6.1 Session Controller

- [ ] Implement SessionController orchestration
- [ ] Add per-stretch flow management
- [ ] Implement side-specific flows (left/right)
- [ ] Add session state persistence

### 6.2 Workflow Management

- [ ] Implement stretch progression logic
- [ ] Add rest period management
- [ ] Create session completion tracking
- [ ] Add user progress storage

### 6.3 Error Handling

- [ ] Add camera permission handling
- [ ] Implement pose detection fallbacks
- [ ] Create user guidance for reframing
- [ ] Add network error handling

---

## Phase 7: Telemetry & Personalization (Week 8)

### 7.1 Metrics Service

- [ ] Implement MetricsService
- [ ] Add privacy-safe logging (no video/images)
- [ ] Create performance metrics tracking
- [ ] Add user behavior analytics

### 7.2 Personalization

- [ ] Implement neutral pose calibration
- [ ] Add threshold adjustment based on user data
- [ ] Create personalized cue preferences
- [ ] Add progress tracking and insights

### 7.3 Data Management

- [ ] Implement local data storage
- [ ] Add data export functionality
- [ ] Create data privacy controls
- [ ] Add data synchronization (optional)

---

## Phase 8: Testing & Optimization (Week 9-10)

### 8.1 Unit Testing

- [ ] Test all service classes
- [ ] Test FSM state transitions
- [ ] Test feature calculations
- [ ] Test cue generation logic

### 8.2 Integration Testing

- [ ] Test camera-to-pose pipeline
- [ ] Test pose-to-features pipeline
- [ ] Test FSM-to-coaching pipeline
- [ ] Test end-to-end user flows

### 8.3 Performance Optimization

- [ ] Optimize frame processing rate
- [ ] Optimize memory usage
- [ ] Optimize battery consumption
- [ ] Test on various devices

### 8.4 User Testing

- [ ] Test with real users
- [ ] Gather feedback on cue timing
- [ ] Validate threshold accuracy
- [ ] Test partial visibility scenarios

---

## Phase 9: Production Preparation (Week 11)

### 9.1 Native Integration

- [ ] Set up Expo Dev Client
- [ ] Integrate native pose estimation library
- [ ] Optimize for production performance
- [ ] Test native vs TF.js performance

### 9.2 Production Configuration

- [ ] Set up production environment
- [ ] Configure TTS service (Deepgram)
- [ ] Set up analytics and crash reporting
- [ ] Configure app store metadata

### 9.3 Final Testing

- [ ] End-to-end testing on production build
- [ ] Performance testing on target devices
- [ ] Battery life testing
- [ ] Network connectivity testing

---

## Phase 10: Launch & Monitoring (Week 12)

### 10.1 App Store Preparation

- [ ] Create app store listings
- [ ] Prepare screenshots and videos
- [ ] Set up app store optimization
- [ ] Submit for review

### 10.2 Launch Monitoring

- [ ] Set up analytics dashboards
- [ ] Monitor performance metrics
- [ ] Track user feedback
- [ ] Plan iteration cycles

---

## Key Performance Targets

### Latency Requirements

- **Camera sampling**: 8-12 FPS
- **Pose inference**: 40-80ms (native) / 80-150ms (TF.js)
- **End-to-coach-speech**: ≤ 600-800ms after deviation confirmation

### Battery Optimization

- Pause pose when app backgrounded
- Reduce frame rate when idle
- Optimize processing pipeline

### Robustness

- Never speak while user is clearly moving
- Wait for stabilization before coaching
- Graceful handling of partial visibility

---

## Risk Mitigation

### Technical Risks

- **Pose accuracy**: Implement fallback strategies and user guidance
- **Performance**: Profile and optimize critical paths
- **Battery drain**: Implement aggressive power management

### User Experience Risks

- **Cue timing**: Extensive user testing and threshold tuning
- **False positives**: Implement hysteresis and cooldowns
- **Partial visibility**: Clear user guidance and reframing prompts

---

## Success Metrics

### Technical Metrics

- Frame processing rate consistency
- Pose detection accuracy
- Cue response time
- Battery consumption

### User Experience Metrics

- User retention rate
- Session completion rate
- Cue accuracy (user feedback)
- Time to correct form issues

---

## Notes

- Start with Plank stretch as MVP
- Add other stretches incrementally
- Focus on core functionality before advanced features
- Maintain privacy-first approach (no video uploads)
- Plan for both Expo Go (dev) and Dev Client (prod) workflows
