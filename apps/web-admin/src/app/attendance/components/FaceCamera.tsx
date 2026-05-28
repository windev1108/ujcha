"use client";

import { Button } from "@heroui/react";
import { Loader2, RefreshCw, ScanFace, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const MODELS_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";

type DetectionState =
  | "init"          // camera + model requests in-flight
  | "no-face"       // ready, no face detected
  | "face-detected" // face in frame
  | "capturing"     // running descriptor extraction
  | "error-camera"  // getUserMedia failed
  | "error-models"; // model load failed

type Props = {
  onCapture: (descriptor: number[]) => Promise<void>;
  isProcessing: boolean;
  actionLabel: string;
};

export function FaceCamera({ onCapture, isProcessing, actionLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const facapiRef = useRef<typeof import("face-api.js") | null>(null);

  const [state, setState] = useState<DetectionState>("init");
  const [faceVisible, setFaceVisible] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setState("init");
      setFaceVisible(false);

      // ── Request camera and load models IN PARALLEL ──────────────────
      // This triggers the browser permission dialog immediately,
      // without waiting for AI models to download first.
      const [streamResult, faceapiResult] = await Promise.allSettled([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        }),
        (async () => {
          const mod = await import("face-api.js");
          const faceapi = (mod.default ?? mod) as typeof import("face-api.js");
          if (!faceapi.nets.tinyFaceDetector.isLoaded) {
            await Promise.all([
              faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
              faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
              faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
            ]);
          }
          return faceapi;
        })(),
      ]);

      if (cancelled) return;

      if (streamResult.status === "rejected") {
        setState("error-camera");
        return;
      }
      if (faceapiResult.status === "rejected") {
        // Stop the stream we already got
        streamResult.value.getTracks().forEach((t) => t.stop());
        setState("error-models");
        return;
      }

      const stream = streamResult.value;
      const faceapi = faceapiResult.value;
      streamRef.current = stream;
      facapiRef.current = faceapi;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch { /* autoplay policy — handled by playsInline */ }
      }

      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

      setState("no-face");
      startDetection(faceapi);
    }

    function startDetection(faceapi: typeof import("face-api.js")) {
      const detect = async () => {
        if (cancelled || !videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState < 2) {
          animRef.current = requestAnimationFrame(detect);
          return;
        }

        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
          .withFaceLandmarks(true);

        if (cancelled) return;

        const dims = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
        faceapi.matchDimensions(canvas, dims);
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
          faceapi.draw.drawFaceLandmarks(canvas, faceapi.resizeResults(detection, dims));
          setFaceVisible(true);
          setState((s) => s === "no-face" || s === "face-detected" ? "face-detected" : s);
        } else {
          setFaceVisible(false);
          setState((s) => s === "face-detected" || s === "no-face" ? "no-face" : s);
        }

        animRef.current = requestAnimationFrame(detect);
      };
      animRef.current = requestAnimationFrame(detect);
    }

    void init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [retryCount]);

  const handleCapture = useCallback(async () => {
    const faceapi = facapiRef.current;
    const video = videoRef.current;
    if (!faceapi || !video || isProcessing) return;

    setState("capturing");

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!detection) {
      setState("face-detected");
      return;
    }

    await onCapture(Array.from(detection.descriptor));
    setState("face-detected");
  }, [onCapture, isProcessing]);

  const isReady = state === "face-detected";
  const isError = state === "error-camera" || state === "error-models";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-black/6 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <ScanFace className="size-5 text-[#1a3c34]" />
        <p className="font-semibold text-foreground">Nhận diện khuôn mặt</p>
      </div>

      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Face guide ring */}
        {!isError && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`size-48 rounded-full border-4 transition-colors duration-300 ${faceVisible ? "border-emerald-400 shadow-[0_0_24px_rgba(74,222,128,0.4)]" : "border-white/30"
                }`}
            />
          </div>
        )}

        {/* Init overlay */}
        {state === "init" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 text-white">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm">Đang khởi động camera và mô hình AI…</p>
          </div>
        )}

        {/* Error: camera */}
        {state === "error-camera" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-white">
            <Video className="size-10 opacity-50" />
            <p className="text-center text-sm font-semibold">Không thể mở camera</p>
            <p className="text-center text-xs text-white/60 leading-relaxed">
              Hãy cấp quyền Camera cho trang web trong cài đặt trình duyệt, rồi nhấn Thử lại.
            </p>
            <button
              onClick={() => setRetryCount((n) => n + 1)}
              className="mt-1 flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/25 transition-colors"
            >
              <RefreshCw className="size-4" />
              Thử lại
            </button>
          </div>
        )}

        {/* Error: models */}
        {state === "error-models" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-white">
            <Loader2 className="size-10 opacity-50" />
            <p className="text-center text-sm font-semibold">Không tải được mô hình AI</p>
            <p className="text-center text-xs text-white/60 leading-relaxed">
              Kiểm tra kết nối mạng và nhấn Thử lại.
            </p>
            <button
              onClick={() => setRetryCount((n) => n + 1)}
              className="mt-1 flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/25 transition-colors"
            >
              <RefreshCw className="size-4" />
              Thử lại
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm font-medium transition-colors ${faceVisible ? "text-emerald-700" : isError ? "text-red-600" : "text-foreground/50"
          }`}>
          {state === "init" && "Đang khởi động…"}
          {state === "no-face" && "Hướng mặt vào vòng tròn"}
          {state === "face-detected" && "Khuôn mặt đã nhận diện ✓"}
          {state === "capturing" && "Đang xử lý…"}
          {state === "error-camera" && "Không thể mở camera"}
          {state === "error-models" && "Lỗi tải mô hình AI"}
        </p>
        <Button
          className="rounded-xl bg-[#1a3c34] px-5 font-semibold text-white"
          onPress={handleCapture}
          isDisabled={!isReady || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Đang xử lý…
            </>
          ) : (
            actionLabel
          )}
        </Button>
      </div>
    </div>
  );
}
