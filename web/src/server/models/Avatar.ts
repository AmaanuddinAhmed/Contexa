import "server-only";

import mongoose, { Document, Schema } from "mongoose";
import type { AvatarType } from "@/server/avatars/image";

export interface IAvatar extends Document {
    userId: mongoose.Types.ObjectId;
    data: Buffer;
    contentType: AvatarType;
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

export const Avatar =
    (mongoose.models.Avatar as mongoose.Model<IAvatar> | undefined) ??
    mongoose.model<IAvatar>("Avatar", avatarSchema, "avatars");