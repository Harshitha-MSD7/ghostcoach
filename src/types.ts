export type Point = { x: number; y: number; confidence: number };
export type Points = Record<string, Point>;
export type Pose = { width: number; height: number; landmarks: Points; inference_seconds: number };
export type Measurement = { id: string; label: string; joints: string[]; reference_angle: number; attempt_angle: number; difference_degrees: number; message: string };
export type Result = {
  reference: Pose; attempt: Pose; normalized: { reference: Points | null; attempt: Points | null };
  measurements: Measurement[]; warnings: string[]; mirror: boolean; confidence_threshold: number;
  edges: [string, string][]; processing_seconds: number; device: string;
};
export type Capture = { blob: Blob; url: string; time: number };
export type Health = { model_status: string; device: string; load_seconds: number | null };
