Here’s the plain-English overview of what we’re building and how it works, end to end:

### What it is

A mobile stretch coach that watches your form through the phone’s camera and gives short, timely voice cues only when you actually need them. It runs on React Native + Expo, works even when parts of your body leave the frame, and never uploads video.

### How it behaves (user experience)

- You pick a stretch (Plank, Hamstring, Quad, Shoulder Cross, Calf).
- The app shows your camera preview and a simple status (“Getting into position…”, “Hold”, “Adjust: hips lower”).
- You hear a single, specific coaching cue only when a real issue persists (no nagging, no ping-pong of “lower/lift”).
- If the app can’t see the right body part, it tells you how to reframe (“Step back so I can see your ankle”).

### What’s happening under the hood (in order)

1. **Camera sampling (8–12 frames per second).**
   We grab lightweight frames on-device—no uploads.

2. **On-device pose estimation.**
   A fast pose model finds keypoints (ears, shoulders, elbows, wrists, hips, knees, ankles, heels, toes) and a confidence score for each. Missing points are marked as “not visible.”

3. **Feature extraction.**
   From those points we compute simple measures: body line straightness, hip height, knee extension, ankle dorsiflexion, shoulder elevation, neck neutrality, and whether those values are moving or stable.

4. **Short rolling memory.**
   We keep the last 1–2 seconds of these measures and smooth them slightly, so one noisy frame doesn’t flip our opinion.

5. **Stretch-specific state machine.**
   For each stretch we define clear states: Waiting → Ready → Holding → (if a deviation persists) Coach_Issue → Cooldown → back to Holding.
   We use hysteresis and short cooldowns so we don’t say “lower… lift… lower…” when you’re in motion.

6. **Event → one cue.**
   When a state change warrants coaching (e.g., hips sagging for >350 ms), we fire exactly one short cue (e.g., “Lower your hips a bit”). Cues are de-duplicated and rate-limited.

7. **Voice feedback without overlap.**
   A single TTS manager queues messages, prevents interruptions, and ensures only one line plays at a time. If a duplicate would play again too soon, we skip it.

8. **Partial-visibility handling.**
   Each stretch declares the minimum points it truly needs. If some aren’t visible, we fall back to one-side measurements or a simpler proxy (e.g., shoulder-hip-ankle on one side for plank). If visibility is too low for \~0.5s, we pause coaching and ask you to reframe.

9. **Lightweight telemetry (privacy-safe).**
   We log only numeric metrics (durations, issues spotted, time-to-correct) to help improve thresholds and personalize the coaching—no images or video.

### What we’re **not** doing (by design)

- No streaming full video to the cloud.
- No constant chatter from the coach.
- No reliance on an LLM for core judgment; it’s deterministic rules on-device.

### What the SWE will actually build (key pieces)

- **Camera module** that delivers frames at a steady rate.
- **Pose module** that outputs keypoints + confidence per frame.
- **Feature engine** that turns keypoints into angles, positions, and “is moving vs stable.”
- **Rolling buffer** that smooths and stores the last 1–2 seconds of features.
- **Per-stretch rule set and state machine** with thresholds, hysteresis, and cooldowns.
- **Cue manager (voice + on-screen)** that says one short line when needed, and shows a simple status banner.
- **TTS manager** with a single queue and built-in de-duplication.
- **Visibility helper** that decides when to coach vs when to ask the user to reframe.
- **Metrics logger** for improvement and personalization.

### Initial scope (MVP)

- Ship **Plank** first (it’s the most universal): hips too high/low, neck neutral, visibility prompts.
- Add **Calf** and **Shoulder Cross** next (simple, reliable keypoints).
- Then **Hamstring** and **Quad** once we’ve validated thresholds and partial-visibility rules.

### Guardrails & targets

- **Latency**: cue should fire within \~0.6–0.8s after a deviation is confirmed.
- **Battery**: pause pose when app is backgrounded; reduce frame rate when idle.
- **Robustness**: never speak while user is clearly moving; wait for them to stabilize.

Perfect—here’s a **high-level architecture + key components** your SWE can implement on **React Native + Expo (Go for dev, Dev Client for prod)**. I’ll note assumptions and how we handle **partial body visibility**.

---

# Assumptions

- **Edge-first**: no video uploaded; we compute pose + logic on device.
- **Expo Go** during prototyping; **Expo Dev Client** for prod (to add native pose/ML for speed).
- **Some keypoints may be missing** in-camera; we must work with partial visibility.
- **TTS = Deepgram** (or platform TTS) via a **single playback queue**.

---

# System Flow (bird’s-eye)

**Camera (8–12 FPS)** → **Pose Estimator (on-device)** → **Feature Engine (angles + velocities)** → **Rolling Buffer (1–2 s, smoothing)** → **Stretch FSM (per-stretch rules, hysteresis)** → **Event Bus** → **Coach Line (LLM or canned)** → **TTS Queue** → **Telemetry (metrics only, no video)**

---

# App Modules (RN/Expo)

## 1) Camera & Sampling

- **`CameraService`**
  - Uses `expo-camera` (or `expo-video` soon).
  - Grabs frames at **8–12 FPS** (interval timer).
  - **ROI cropping** (optional) to focus on torso/leg depending on stretch.
  - Emits `{frameId, timestamp, imageBitmapOrTensor}` to Pose.

**Key props**

```ts
type Frame = { id: string; t: number; bitmap: ImageBitmap | Uint8Array };
```

---

## 2) Pose Estimator (on-device)

- **`PoseService`**
  - Dev (Expo Go): run **TF.js WASM/WebGL** pose model (lower FPS, OK for MVP).
  - Prod (Dev Client): swap to a **native pose lib** (e.g., MediaPipe/MLKit wrapper) for speed.
  - Outputs **2D keypoints** with **confidence**.
  - Handles **partial visibility**: mark `kp.visible = conf >= 0.6`.

**Output**

```ts
type KeypointName =
  | 'ear_l'
  | 'ear_r'
  | 'shoulder_l'
  | 'shoulder_r'
  | 'elbow_l'
  | 'elbow_r'
  | 'wrist_l'
  | 'wrist_r'
  | 'hip_l'
  | 'hip_r'
  | 'knee_l'
  | 'knee_r'
  | 'ankle_l'
  | 'ankle_r'
  | 'heel_l'
  | 'heel_r'
  | 'toe_l'
  | 'toe_r';

type Keypoint = { x: number; y: number; conf: number; visible: boolean };
type Pose = Record<KeypointName, Keypoint>;
```

---

## 3) Feature Engine (angles + velocities)

- **`FeatureEngine`**
  - Computes **joint angles** (hip, knee, shoulder), **segment angles** (shoulder→hip→ankle “body line”), **neck angle** (ear–shoulder vs shoulder–hip), **heel-down flag** (heel y vs ankle y), etc.
  - Computes **Δangle/Δt** (velocity) to know if user is moving vs stable.
  - **Graceful degradation**: if a keypoint missing, use **side proxy** or **segment fallback** (see “Partial Visibility Rules” below).

**Output**

```ts
type Features = {
  bodyLineDeg?: number; // plank proxy (shoulder-hip-ankle collinearity)
  neckDeg?: number; // ear-shoulder-hip
  hipFlexDeg_l?: number;
  hipFlexDeg_r?: number;
  kneeExtDeg_l?: number;
  kneeExtDeg_r?: number;
  ankleDorsiDeg_l?: number;
  ankleDorsiDeg_r?: number;
  footTurnoutDeg_l?: number;
  footTurnoutDeg_r?: number;
  velocities: Record<string, number>; // d(angle)/dt
  visibilityScore: number; // 0..1 weighted by used points
};
```

---

## 4) Temporal Buffer & Smoothing

- **`MotionBuffer`**
  - Rolling **1–2 s** (10–20 frames).
  - EMA smoothing (α≈0.5–0.7) on angles; median filter on visibility.
  - Utility to query **stability windows** (e.g., “value inside band for ≥400 ms”).

---

## 5) Stretch Finite-State Machine (FSM)

- **`StretchFSM` (generic runner)** + **per-stretch config**.
- States: `WAITING → READY → HOLDING ↔ COACH_<issue> → COOLDOWN → HOLDING`, with **hysteresis** & **cooldowns** to prevent “lift/lower ping-pong”.

**Generic engine**

```ts
type Issue =
  | 'HIP_SAG'
  | 'HIP_HIGH'
  | 'NEUTRAL_NECK'
  | 'STRAIGHTEN_KNEE'
  | 'NEUTRAL_BACK'
  | 'SQUARE_HIPS'
  | 'KNEES_TOGETHER'
  | 'TUCK_PELVIS'
  | 'RIBS_DOWN'
  | 'RELAX_SHOULDER'
  | 'ELBOW_AT_SHOULDER_HEIGHT'
  | 'KEEP_TORSO_FORWARD'
  | 'KEEP_HEEL_DOWN'
  | 'POINT_TOES_FORWARD';

type FsmEvent = {
  type: 'COACH' | 'HOLD_GOOD' | 'WAITING';
  issue?: Issue;
  severity?: 'mild' | 'mod' | 'high';
};

type StretchConfig = {
  name: 'plank' | 'hamstring' | 'quad' | 'shoulder_cross' | 'calf';
  // thresholds & guards; see examples below
  rules: (buffer: MotionBuffer, feats: Features) => FsmEvent | null;
  cooldownMs: number; // e.g., 1500
  motionGate: { velMaxDegPerS: number; settleMs: number }; // suppress cues while moving
};
```

**Example: Plank thresholds (starter)**

- **Body line OK**: |bodyLineDeg| ≤ **6°** for ≥ **500 ms**.
- **HIP_SAG**: bodyLineDeg < −9° for ≥ **350 ms** (exit at −7°).
- **HIP_HIGH**: bodyLineDeg > +9° for ≥ **350 ms** (exit at +7°).
- **NEUTRAL_NECK**: neckDeg ≥ **160°**; coach if < **150°** for ≥ **400 ms**.
- **Motion gate**: if |d(bodyLineDeg)/dt| > **12°/s**, don’t coach yet.

**Hamstring (standing hinge) highlights**

- **Knee straight** target: kneeExtDeg ≥ **165°** (mild) / **170°** (strict).
- **STRAIGHTEN_KNEE** if < **155°** for ≥ 400 ms (when variant expects straight).
- **NEUTRAL_BACK**: ear–shoulder–hip collinearity ≥ **165°**; else coach.
- **SQUARE_HIPS** if pelvis yaw drift > **10–12°** for ≥ 400 ms.

(Quad, Shoulder Cross, Calf follow the same pattern; you already have issues list.)

---

## 6) Event Bus

- **`EventBus`** (tiny pub/sub or Redux/Zustand event channel).
- Emits **distinct events only** (de-dup by `(issue, severity)` within cooldown window).

```ts
type CoachEvent = {
  id: string;
  stretch: string;
  issue: Issue;
  severity: 'mild' | 'mod' | 'high';
  t: number; // timestamp
};
```

---

## 7) Coach Line Generator (LLM-light)

- **`CoachService`**
  - On **COACH** event, build a **tiny JSON summary** (stretch, issue, severity, durationHolding, side if unilateral).
  - Ask LLM **only then** for **ONE short line** (≤12 words). Cache per `(stretch, issue, severity)`.
  - Fallback to **canned lines** offline.

```ts
type CoachSummary = {
  stretch: string;
  issue: Issue;
  severity: string;
  dur_s: number;
  side?: 'left' | 'right';
};
```

---

## 8) TTS Manager (single-flight queue)

- **`SpeechManager`**
  - Centralizes TTS (Deepgram or platform).
  - **Queue with categories** and **cooldowns** (e.g., suppress repeating HIP_SAG within 2 s).
  - **Replace-latest** policy for higher priority messages.
  - Exposes `speak({ text, category })` and returns a promise that resolves on playback end.

---

## 9) Session Controller & UI

- **`SessionController`**
  - Orchestrates the pipeline per selected stretch.
  - Maintains **per-side flow** for unilateral stretches (e.g., hamstring left → right).
  - Provides **status** (`Waiting`, `Ready`, `Holding`, `Great hold!`, last cue).
  - Rate-limited **positive reinforcement** (e.g., every 12–15 s).

- **Screens**
  - `HomeScreen` (choose stretch) → `SessionScreen` (camera preview + live prompts + timer).
  - Visual overlay: **keypoints + skeleton** (optional) and a **traffic-light banner** (Good / Adjust).

---

## 10) Telemetry & Personalization

- **`MetricsService`**
  - Logs **only numeric/semantic metrics**: times in hold, cues issued, time-to-correct, average angles, no frames.
  - **Per-user calibration**: capture a quick **“neutral snapshot”** at start (e.g., user’s natural plank body line). Tighten thresholds around their neutral for better feel.

---

# Partial Visibility: Practical Rules

Users won’t always fit entirely in frame. Strategies:

1. **Per-stretch minimal keypoints** (declare up-front):
   - **Plank**: shoulders, hips, ankles **(one side is enough)** + ear (for neck).
   - **Hamstring (standing)**: hip, knee, ankle **of the working leg** + shoulder or ear on same side (for back neutrality).
   - **Quad (standing)**: hip, knee, ankle of stretching leg; contralateral knee optional for “knees together”.
   - **Shoulder Cross**: shoulder, elbow, wrist **of working arm** + ear (to detect shoulder hiking).
   - **Calf**: ankle, heel, toe of front foot; knee for straight/bent variant.

2. **Fallback computation**:
   - If both sides unavailable, compute **unilateral** angles (e.g., shoulder_l→hip_l→ankle_l) as proxy for body line.
   - If ear missing, approximate neck from **shoulder-hip vs torso orientation**.

3. **Visibility guard**:
   - Compute a **visibilityScore** (weighted by required points).
   - If below threshold for **>500 ms**, FSM → `WAITING`, speak: “Step back a little so I can see your \[leg/arm].”

4. **Directional hints**:
   - From the missing point, infer **how to reframe**: “Tilt phone down to include your ankle.”

---

# Project Structure (suggested)

```
/src
  /camera/CameraService.ts
  /pose/PoseService.ts         // tfjs (Go) + native (Dev Client)
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
  /ui/screens/*.tsx
  /ui/components/*.tsx
  /config/constants.ts
```

---

# Performance Targets (mobile)

- **Camera sampling**: 8–12 FPS.
- **Pose inference**: 40–80 ms (native) / 80–150 ms (tfjs dev).
- **End-to-coach-speech**: ≤ 600–800 ms after deviation persists and is confirmed.
- **Battery**: Pause pose when app backgrounded; dim overlay when idle.

---

# Minimal Integration Loop (glue)

```ts
// SessionController.ts
setInterval(async () => {
  const frame = await CameraService.grab();
  const pose = await PoseService.estimate(frame);
  const feats = FeatureEngine.compute(pose);
  MotionBuffer.push(feats);

  const event = StretchFSM.step(configFor(currentStretch), MotionBuffer);
  if (!event) return;

  if (event.type === 'COACH') {
    const summary = summarize(event, MotionBuffer);
    const line = await CoachService.oneLiner(summary); // cached
    SpeechManager.speak({ text: line, category: event.issue! });
  } else if (event.type === 'WAITING') {
    SpeechManager.speakOncePer(
      'WAITING_HINT',
      'Step back so I can see your ankle.'
    );
  }
}, 1000 / 10); // 10 FPS
```

---

# Expo Notes (important)

- **Expo Go**: use **TF.js WebGL/WASM** for pose; slower but fine for MVP.
- **Prod**: create an **Expo Dev Client** to add native pose/NN libs for 2–3× speed.
- Migrate **`expo-av` → `expo-audio`/`expo-video`**. Wrap TTS in `SpeechManager` so the rest of the app doesn’t know which TTS you use.
- Gate LLM usage behind **event triggers** only (cost + latency control).
