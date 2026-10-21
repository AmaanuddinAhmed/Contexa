import "server-only";

import mongoose from "mongoose";
import { Avatar } from "@/server/models/Avatar";
import { avatarPath, googlePhotoAtSize, MAX_AVATAR_BYTES, sniffImageType } from "./image";

/** Picture URLs for a set of users, by user id. Users without one are absent. */
export const avatarUrlsFor = async (
    userIds: (string | mongoose.Types.ObjectId)[]
): Promise<Map<string, string>> => {
    if (userIds.length === 0) {
        return new Map();
    }

    const avatars = await Avatar.find({ userId: { $in: userIds } })
        .select({ userId: 1, updatedAt: 1 })
        .lean();

    return new Map(
        avatars.map((avatar) => [
            avatar.userId.toString(),
            avatarPath(avatar.userId.toString(), avatar.updatedAt)
        ])
    );
};

export const avatarUrlFor = async (userId: string): Promise<string | null> =>
    (await avatarUrlsFor([userId])).get(userId) ?? null;

/**
 * Copies the Google account photo as the user's picture, unless they already
 * have one. Best effort: sign-in never fails because of it.
 */
export const copyGooglePhotoIfMissing = async (userId: string, pictureUrl: string): Promise<void> => {
    try {
        if (await Avatar.exists({ userId })) {
            return;
        }

        const url = new URL(googlePhotoAtSize(pictureUrl));

        // Only Google's photo host, so this can never fetch arbitrary URLs.
        if (url.protocol !== "https:" || !url.hostname.endsWith(".googleusercontent.com")) {
            return;
        }

        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

        if (!response.ok) {
            return;
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        const contentType = sniffImageType(bytes);

        if (!contentType || bytes.length > MAX_AVATAR_BYTES) {
            return;
        }

        await Avatar.updateOne(
            { userId },
            { $setOnInsert: { userId, data: Buffer.from(bytes), contentType, source: "google" } },
            { upsert: true }
        );
    } catch (error) {
        console.error("Copy Google photo failed:", error);
    }
};