"use client";

const MAX_SIDE = 1280;

/** Shrinks a photo to ≤1280 px JPEG in the browser so the upload is small and holds no EXIF location. */
export async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Centre-cropped square JPEG for avatars (default 256 px, ~15–30 KB), no EXIF. */
export async function squareAvatar(file: File, side = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const crop = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = side; canvas.height = side;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, side, side);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
