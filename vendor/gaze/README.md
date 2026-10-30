# Local webcam gaze-estimation assets

The demo uses Google's MediaPipe Face Landmarker to obtain face and iris
landmarks locally, then learns a temporary screen mapping from the user's nine
calibration targets. The landmarker is not itself an eye-gaze model and the
calibration is not an assessment of clinical or assistive-device accuracy.

Runtime: `@mediapipe/tasks-vision` **0.10.32**, Apache-2.0. Original code and
WebAssembly files are unmodified. The complete upstream license is in `LICENSE`.
The official Face Landmarker float16 model bundle is version **1**.

Sources:

- Package: https://registry.npmjs.org/@mediapipe/tasks-vision/0.10.32
- Code and license: https://github.com/google-ai-edge/mediapipe/tree/v0.10.32
- Model: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- Model documentation: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker
- Face detector model card (Apache-2.0): https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Short%20Range).pdf
- Face mesh model card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf
- Blendshape model card (Apache-2.0): https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf

Prepare or verify from the project root:

```bash
node scripts/prepare-gaze-assets.mjs
node scripts/prepare-gaze-assets.mjs --check
```

The preparation script downloads only the pinned upstream artifacts and verifies
their SHA-256 hashes. It does not alter application dependencies or the lockfile.
The browser subsequently loads these same-origin files and processes video
locally. It does not upload camera frames, face landmarks or calibration samples
and does not persist calibration data. Camera access starts only after the user
switches the detector on; switching off stops tracks and discards calibration.
Webcam position, lighting, glasses, motion and the user's eyes affect estimates.
