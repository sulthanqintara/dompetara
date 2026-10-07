import "server-only";
import sharp from "sharp";
import { logServerError } from "@/lib/log-server-error";

export async function normalizeReceiptImage(file: File) {
  try {
    if (!file.size || file.size > 4_000_000)
      throw new Error("Choose a JPEG or PNG smaller than 4 MB after resizing.");
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 36_000_000,
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) !== 1
    )
      throw new Error("Choose a single JPEG or PNG image.");
    // Sharp removes EXIF/GPS and other metadata unless explicitly retained.
    const bytes = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90 })
      .toBuffer();
    if (bytes.length > 4_000_000)
      throw new Error("Crop this receipt before saving its image.");
    return bytes;
  } catch (error) {
    logServerError(
      { method: "POST", path: "/api/ledger", stage: "validate receipt image" },
      error,
    );
    throw new Error("Choose a valid JPEG or PNG within the upload limits.", {
      cause: 400,
    });
  }
}
