# Mobile Stretch Coach

A React Native + Expo mobile app that provides real-time form coaching for stretching exercises using on-device pose estimation and voice feedback.

## Technology Stack

- **Framework**: React Native + Expo
- **Development**: Expo Go (prototyping) → Expo Dev Client (production)
- **Pose Estimation**: TF.js (dev) → Native pose lib (prod)
- **TTS**: Deepgram or platform TTS
- **Language**: TypeScript
- **State Management**: Zustand
- **Navigation**: React Navigation

## Project Structure

```
/src
  /camera/CameraService.ts          # Camera operations and frame capture
  /pose/PoseService.ts              # Pose estimation using TF.js
  /features/FeatureEngine.ts        # Pose features and angle calculations
  /motion/MotionBuffer.ts           # Rolling buffer for motion data
  /fsm/StretchFSM.ts               # Finite State Machine for coaching
  /fsm/config/                     # Stretch-specific configurations
    plank.ts
    hamstring.ts
    quad.ts
    shoulder_cross.ts
    calf.ts
  /coach/CoachService.ts           # Coaching cue generation
  /speech/SpeechManager.ts         # TTS and speech queue management
  /session/SessionController.ts    # Session orchestration
  /telemetry/MetricsService.ts     # Telemetry and analytics
  /ui/screens/                     # Main screens
    HomeScreen.tsx
    SessionScreen.tsx
  /ui/components/                  # Reusable components
    CameraPreview.tsx
    StatusBanner.tsx
    StretchSelector.tsx
  /types/index.ts                  # TypeScript type definitions
  /config/constants.ts             # App-wide constants
```

## Development Setup

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd mobile-stretch-coach
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

### Available Scripts

- `npm start` - Start the Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS device/simulator
- `npm run web` - Run in web browser
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking

## Development Phases

This project follows a structured development approach across multiple phases:

- **Phase 1**: Project Setup & Foundation ✅
- **Phase 2**: Core Services Implementation
- **Phase 3**: FSM System Implementation
- **Phase 4**: Coaching & Voice System
- **Phase 5**: UI Implementation
- **Phase 6**: Session Management
- **Phase 7**: Telemetry & Personalization
- **Phase 8**: Testing & Optimization
- **Phase 9**: Production Preparation
- **Phase 10**: Launch & Monitoring

## Performance Targets

- **Camera sampling**: 8-12 FPS
- **Pose inference**: 40-80ms (native) / 80-150ms (TF.js)
- **End-to-coach-speech**: ≤ 600-800ms after deviation confirmation

## Contributing

1. Follow the existing code style (ESLint + Prettier)
2. Write TypeScript with strict type checking
3. Add appropriate tests for new features
4. Update documentation as needed

## License

[Add your license information here]
