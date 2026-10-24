import "server-only";

import mongoose, { Document, Schema } from "mongoose";

export interface IRateLimit extends Document {
    key: string;
    count: number;
    expiresAt: Date;
}

const rateLimitSchema = new Schema<IRateLimit>({
    key: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true }
});

rateLimitSchema.index({ key: 1 }, { unique: true });
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit =
    (mongoose.models.RateLimit as mongoose.Model<IRateLimit> | undefined) ??
    mongoose.model<IRateLimit>("RateLimit", rateLimitSchema, "rate_limits");