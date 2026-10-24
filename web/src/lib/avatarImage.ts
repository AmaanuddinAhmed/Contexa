"use client";

const SIZE = 256;

export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

const toBlob = (canvas: HTMLCanvasElement, type: string): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));

export const prepareAvatar = async (file: File): Promise<Blob> => {
    if (!file.type.startsWith("image/")) {
        throw new Error("Choose an image file.");
    }

    if (file.size > MAX_SOURCE_BYTES) {
        throw new Error("That image is too large. Choose one under 20 MB.");
    }

    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
        throw new Error("That image could not be opened. Try a JPEG or PNG.");
    }

    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;

    const context = canvas.getContext("2d");
    if (!context) {
        bitmap.close();
        throw new Error("Your browser could not resize the image.");
    }

    context.imageSmoothingQuality = "high";
    context.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        SIZE,
        SIZE,
    );
    bitmap.close();

    const webp = await toBlob(canvas, "image/webp");
    if (webp && webp.type === "image/webp") {
        return webp;
    }

    const jpeg = await toBlob(canvas, "image/jpeg");
    if (!jpeg) {
        throw new Error("Your browser could not resize the image.");
    }
    return jpeg;
};