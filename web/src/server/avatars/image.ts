export const AVATAR_SIZE = 256;

export const MAX_AVATAR_BYTES = 300 * 1024;

export type AvatarType = "image/jpeg" | "image/png" | "image/webp";

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

export const avatarPath = (userId: string, version: Date): string =>
    `/api/v1/avatars/${userId}?v=${version.getTime()}`;

export const googlePhotoAtSize = (url: string, size = AVATAR_SIZE): string =>
    /=s\d+(-c)?$/.test(url) ? url.replace(/=s\d+(-c)?$/, `=s${size}-c`) : `${url}=s${size}-c`;