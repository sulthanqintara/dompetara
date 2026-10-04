import { extractionSchema, type Extraction } from "./receipts";
export async function readReceipt(
  file: File,
  method: "ocr" | "ai",
  signal: AbortSignal,
): Promise<Extraction> {
  if (
    !["image/jpeg", "image/png"].includes(file.type) ||
    file.size > 16_000_000
  )
    throw new Error("Choose a JPEG or PNG smaller than 16 MB.");
  const bitmap = await createImageBitmap(file);
  let blob: Blob;
  try {
    const scale = Math.min(1, 2500 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Could not prepare this image.")),
        "image/jpeg",
        0.9,
      ),
    );
  } finally {
    bitmap.close();
  }
  if (blob.size > 4_000_000)
    throw new Error(
      "This image is too large after resizing. Try a closer crop.",
    );
  signal.throwIfAborted();
  const form = new FormData();
  form.set("image", blob, "receipt.jpg");
  form.set("method", method);
  const response = await fetch("/api/receipts/extract", {
    method: "POST",
    body: form,
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not read receipt.");
  const parsed = extractionSchema.safeParse(result);
  if (!parsed.success)
    throw new Error(
      "The receipt response was invalid. Try another image or enter the transaction manually.",
    );
  return parsed.data;
}
