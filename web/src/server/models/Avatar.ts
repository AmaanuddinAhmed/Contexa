import "server-only";

import mongoose, { Document, Schema } from "mongoose";
import type { AvatarType } from "@/server/avatars/image";

/**
 * A user's profile picture, kept apart from Profile so listing profiles
 * never loads image bytes. updatedAt doubles as the cache version.
 */
export interface IAvatar extends Document {
    userId: mongoose.Types.ObjectId;
    data: Buffer;
    contentType: AvatarType;
    /** "google" when copied from the Google account at sign-in. */
    source: "upload" | "google";
    createdAt: Date;
    updatedAt: Date;
}

const avatarSchema = new Schema<IAvatar>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        data: { type: Buffer, required: true },
        contentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"], required: true },
        source: { type: String, enum: ["upload", "google"], required: true }
    },
    { timestamps: true }
);

// Reuse the compiled model when Next.js reloads this module in development.
export const Avatar =
    (mongoose.models.Avatar as mongoose.Model<IAvatar> | undefined) ??
    mongoose.model<IAvatar>("Avatar", avatarSchema, "avatars");