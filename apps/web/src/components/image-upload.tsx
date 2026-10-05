"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { buttonClass } from "./ui";

// Picks a picture, crops it to the right shape and shrinks it in the browser,
// then uploads it. Phone photos (often 3–10 MB) end up around 100–300 KB.

const TARGET = {
  AVATAR: { width: 512, height: 512 }, // square
  BANNER: { width: 1500, height: 500 }, // 3:1
} as const;

/** Center-crops to the target shape and scales down (never up). */
async function resize(file: File, kind: keyof typeof TARGET): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const target = TARGET[kind];
  const ratio = target.width / target.height;
  // Largest centered region of the source with the target's shape.
  const cropW = Math.min(bitmap.width, bitmap.height * ratio);
  const cropH = cropW / ratio;
  const scale = Math.min(1, target.width / cropW);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropW * scale);
  canvas.height = Math.round(cropH * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, (bitmap.width - cropW) / 2, (bitmap.height - cropH) / 2, cropW, cropH, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not process that picture"))), "image/jpeg", 0.85),
  );
}

export function ImageUpload({ kind, hasImage, label }: { kind: "AVATAR" | "BANNER"; hasImage: boolean; label: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ busy?: "upload" | "remove"; error?: string; done?: string }>({});

  async function upload(file: File) {
    setState({ busy: "upload" });
    try {
      const blob = await resize(file, kind).catch(() => {
        throw new Error("That file doesn't look like a picture we can use. Try a JPEG or PNG.");
      });
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", blob, kind === "AVATAR" ? "avatar.jpg" : "banner.jpg");
      const res = await fetch("/api/business/images", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Upload failed. Please try again.");
      setState({ done: "Uploaded" });
      router.refresh();
    } catch (err) {
      setState({ error: (err as Error).message });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setState({ busy: "remove" });
    const res = await fetch(`/api/business/images?kind=${kind}`, { method: "DELETE" });
    setState(res.ok ? { done: "Removed" } : { error: "Couldn't remove it. Please try again." });
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        aria-label={label}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <button type="button" disabled={!!state.busy} onClick={() => input.current?.click()} className={`${buttonClass.secondary} px-3 py-1.5`}>
        {state.busy === "upload" ? "Uploading…" : hasImage ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
      </button>
      {hasImage && (
        <button type="button" disabled={!!state.busy} onClick={remove} className="rounded px-2 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-red-700">
          {state.busy === "remove" ? "Removing…" : "Remove"}
        </button>
      )}
      <span aria-live="polite" className="text-sm">
        {state.error && <span className="text-red-700">{state.error}</span>}
        {state.done && <span className="text-emerald-700">{state.done}</span>}
      </span>
    </div>
  );
}
