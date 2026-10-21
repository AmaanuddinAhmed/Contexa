/**
 * Profile picture rules. Pure functions only, so they can be unit tested.
 *
 * The browser resizes photos to AVATAR_SIZE before uploading; the server
 * still checks the size and the file's real type (from its first bytes,
 * not the Content-Type header) before storing anything.
 */

export const AVATAR_SIZE = 256;

/** A 256 px WebP or JPEG is usually 10–40 KB; this leaves room. */
export const MAX_AVATAR_BYTES = 300 * 1024;

export type AvatarType = "image/jpeg" | "image/png" | "image/webp";

/** The image type from the file's first bytes, or null if not one we accept. */
export const sniffImageType = (bytes: Uint8Array): AvatarType | null => {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return "image/jpeg";
    }

    if (
        bytes.length >= 8 &&
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
    ) {
        return "image/png";
    }

    const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));

    if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
        return "image/webp";
    }

    return null;
};

/** Where a stored picture is served. `version` changes on every upload, for caching. */
export const avatarPath = (userId: string, version: Date): string =>
    `/api/v1/avatars/${userId}?v=${version.getTime()}`;

/**
 * Google photo URLs end in a size option such as "=s96-c"; ask for one at
 * our size instead of the small default.
 */
export const googlePhotoAtSize = (url: string, size = AVATAR_SIZE): string =>
    /=s\d+(-c)?$/.test(url) ? url.replace(/=s\d+(-c)?$/, `=s${size}-c`) : `${url}=s${size}-c`;