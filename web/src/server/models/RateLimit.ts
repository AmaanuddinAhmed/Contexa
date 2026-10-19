import "server-only";

import mongoose, { Document, Schema } from "mongoose";

/**
 * One counter per (policy, identifier, time window); see rateLimit/rules.ts.
 * MongoDB's TTL monitor deletes each counter once its window has ended
 * (it runs about once a minute, so deletion can lag slightly; the key
 * includes the window start, so a late deletion never affects a new window).
 */
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

// Reuse the compiled model when Next.js reloads this module in development.
export const RateLimit =
    (mongoose.models.RateLimit as mongoose.Model<IRateLimit> | undefined) ??
    mongoose.model<IRateLimit>("RateLimit", rateLimitSchema, "rate_limits");