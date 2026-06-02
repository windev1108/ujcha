"use client";

import { Button, Modal, useOverlayState } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Camera, CloudUpload, Loader2, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { useAppDialog } from "@/components/common/app-dialog-provider";
import { upsertFaceProfile } from "@/services/admin/hrm-api";
import type { StaffWithFaceProfile } from "@/services/admin/types";

function axiosMsg(e: unknown) {
  const err = e as AxiosError<{ message?: string | string[] }>;
  const m = err.response?.data?.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join(", ");
  return err.message || "Có lỗi xảy ra.";
}

const MODELS_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";

async function loadModels() {
  const mod = await import("face-api.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceapi = (mod.default ?? mod) as typeof mod;
  if (!faceapi.nets.tinyFaceDetector.isLoaded) {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]);
  }
  return faceapi;
}

async function extractDescriptorFromImage(
  img: HTMLImageElement,
): Promise<Float32Array | null> {
  const faceapi = await loadModels();
  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true)
    .withFaceDescriptor();
  return detection?.descriptor ?? null;
}

async function uploadToCloudinary(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload/face", { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Upload ảnh thất bại.");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

type Props = {
  staff: StaffWithFaceProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function FaceSetupModal({ staff, isOpen, onClose, onSuccess }: Props) {
  const modal = useOverlayState({ isOpen, onOpenChange: (o) => { if (!o) onClose(); } });
  const { showAlert } = useAppDialog();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [errMsg, setErrMsg] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!staff || !descriptor || !pendingFile) throw new Error("missing data");
      const imageUrl = await uploadToCloudinary(pendingFile);
      return upsertFaceProfile(staff.id, { descriptor, imageUrl });
    },
    onSuccess: () => onSuccess(),
    onError: (e) => showAlert(axiosMsg(e), "Lỗi"),
  });

  const handleFile = useCallback(async (file: File) => {
    const blobUrl = URL.createObjectURL(file);
    setPreview(blobUrl);
    setPendingFile(file);
    setStatus("processing");
    setDescriptor(null);
    setErrMsg("");

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = blobUrl;
    await new Promise<void>((res) => { img.onload = () => res(); });

    try {
      const desc = await extractDescriptorFromImage(img);
      if (!desc) {
        setStatus("error");
        setErrMsg("Không phát hiện khuôn mặt trong ảnh. Hãy dùng ảnh chụp thẳng, rõ mặt.");
        return;
      }
      setDescriptor(Array.from(desc));
      setStatus("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[face-api] extractDescriptor failed:", err);
      setStatus("error");
      setErrMsg(`Lỗi khi phân tích khuôn mặt: ${msg}`);
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = "";
  };

  const reset = () => {
    setPreview(null);
    setPendingFile(null);
    setStatus("idle");
    setDescriptor(null);
    setErrMsg("");
  };

  if (!staff) return null;

  return (
    <Modal.Root state={modal}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>
                Đăng ký khuôn mặt — {staff.phone?.[0] ?? "Staff"}
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <Modal.Body className="space-y-4">
              <p className="text-sm text-foreground/60">
                Tải ảnh chân dung rõ mặt của nhân viên. Hệ thống sẽ trích xuất
                face descriptor để nhận diện khi chấm công.
              </p>

              {!preview ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-black/15 bg-[#fafafa] py-10 text-foreground/50 transition hover:border-[#1a3c34]/40 hover:bg-[#f0f7f4]"
                >
                  <Upload className="size-8" />
                  <span className="text-sm font-medium">Chọn ảnh khuôn mặt</span>
                  <span className="text-xs">JPG, PNG · rõ mặt, ánh sáng đủ</span>
                </button>
              ) : (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full max-h-64 rounded-2xl object-contain bg-black/4"
                  />
                  {status !== "processing" && (
                    <button
                      onClick={reset}
                      className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                      aria-label="Xóa ảnh"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              )}

              {status === "processing" && (
                <div className="flex items-center gap-2 text-sm text-foreground/60">
                  <Loader2 className="size-4 animate-spin" />
                  Đang nhận diện khuôn mặt…
                </div>
              )}
              {status === "done" && (
                <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                  ✓ Nhận diện thành công. Nhấn &quot;Lưu&quot; để đăng ký.
                </p>
              )}
              {status === "error" && (
                <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{errMsg}</p>
              )}
            </Modal.Body>

            <Modal.Footer className="flex justify-end gap-2">
              <Button variant="ghost" onPress={onClose} isDisabled={status === "processing" || mut.isPending}>
                Hủy
              </Button>
              <Button
                className="bg-[#1a3c34] font-semibold text-white"
                onPress={() => fileRef.current?.click()}
                isDisabled={status === "processing" || mut.isPending}
                variant={status === "done" ? "outline" : "primary"}
              >
                <Camera className="mr-2 size-4" />
                {preview ? "Đổi ảnh" : "Chọn ảnh"}
              </Button>
              {status === "done" && (
                <Button
                  className="bg-[#1a3c34] font-semibold text-white"
                  onPress={() => mut.mutate()}
                  isDisabled={mut.isPending}
                >
                  {mut.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Đang upload & lưu…
                    </>
                  ) : (
                    <>
                      <CloudUpload className="mr-2 size-4" />
                      Lưu khuôn mặt
                    </>
                  )}
                </Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </Modal.Root>
  );
}
