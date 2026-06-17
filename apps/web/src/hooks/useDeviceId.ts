"use client";
import { useEffect, useState } from "react";

/**
 * Compute a stable fingerprint from hardware/system signals only.
 *
 * Design goals:
 * - Same result in Chrome regular AND incognito (no localStorage UUID).
 * - Same result across different browsers on the same physical device
 *   (Chrome vs Edge — both Chromium, same rendering engine, same canvas output).
 * - userAgent is intentionally excluded: it differs between Chrome and Edge
 *   even on the same machine.
 * - Canvas + WebGL use the same Skia/GPU pipeline in all Chromium browsers,
 *   so their output is bit-for-bit identical across Chrome/Edge/Brave/Opera.
 */
async function computeFingerprint(): Promise<string> {
  const nav = navigator as Navigator & { deviceMemory?: number };

  // Canvas fingerprint — same for all Chromium browsers (Chrome, Edge, Brave, Opera)
  // because they share the Skia rendering engine and the same GPU path.
  let canvasHash = "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(100, 5, 80, 30);
      ctx.fillStyle = "#069";
      ctx.font = "bold 14px Arial,sans-serif";
      ctx.fillText("UjCha☂", 2, 20);
      ctx.fillStyle = "rgba(102,204,0,0.9)";
      ctx.font = "11px Georgia,serif";
      ctx.fillText("device௫", 4, 40);
      canvasHash = canvas.toDataURL("image/png").slice(-48);
    }
  } catch {
    // canvas blocked by browser policy
  }

  // WebGL GPU vendor + renderer — hardware-level strings, identical across all
  // browsers on the same GPU (Chrome, Edge, Firefox all report the same GPU name).
  let webglVendor = "";
  let webglRenderer = "";
  try {
    const gl = document.createElement("canvas").getContext("webgl") as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        webglVendor = String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL));
        webglRenderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
      }
    }
  } catch {
    // WebGL unavailable (e.g. headless browser)
  }

  const components = [
    // Physical screen — OS-level, not browser-level
    screen.width,
    screen.height,
    screen.colorDepth,
    screen.availWidth,
    screen.availHeight,
    window.devicePixelRatio ?? 1,
    // CPU / memory — reported from the OS, same across all browsers
    nav.hardwareConcurrency ?? 0,
    nav.deviceMemory ?? 0,
    // System locale / timezone — OS setting, same across browsers
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    new Date().getTimezoneOffset(),
    // OS platform string — same across browsers on same machine
    navigator.platform ?? "",
    navigator.maxTouchPoints ?? 0,
    // Rendering-engine fingerprints
    canvasHash,
    webglVendor,
    webglRenderer,
  ].join("|");

  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(components),
  );
  const hex = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// Per-JS-context cache — avoids recomputing within the same tab session.
// Intentionally NOT persisted to localStorage: incognito must recompute
// from hardware and arrive at the same value, not find a cached random UUID.
let _fp: Promise<string> | null = null;

export function getDeviceId(): Promise<string> {
  if (!_fp) _fp = computeFingerprint();
  return _fp;
}

export function useDeviceId(): string | null {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);
  return deviceId;
}
