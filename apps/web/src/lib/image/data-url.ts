/** Data URL of a JPEG/PNG/WebP image, at most ~2 MB of base64 (the browser shrinks photos to ≤1280 px first). */
export const isImageDataUrl = (value: unknown): value is string => typeof value === "string" && value.length <= 2_800_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
