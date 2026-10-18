import "server-only";

import mongoose, { Document, Schema } from "mongoose";

/**
 * A user's approximate area for the map (opt-in). Only the centre of a grid
 * cell about 1 km across is stored (see lib/location.ts); deleting this
 * record stops sharing completely.
 */
export interface IUserLocation extends Document {
    userId: mongoose.Types.ObjectId;
    lat: number;
    lng: number;
    /** Hidden from everyone's map while true; the area is kept. */
    ghost: boolean;
    /** When the area was last set (not changed by toggling ghost mode). */
    positionUpdatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const userLocationSchema = new Schema<IUserLocation>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        lat: { type: Number, required: true, min: -90, max: 90 },
        lng: { type: Number, required: true, min: -180, max: 180 },
        ghost: { type: Boolean, default: false },
        positionUpdatedAt: { type: Date, required: true }
    },
    { timestamps: true }
);

// One area per user; the map loads connections' areas by user id.
userLocationSchema.index({ userId: 1 }, { unique: true });

// Reuse the compiled model when Next.js reloads this module in development.
export const UserLocation =
    (mongoose.models.UserLocation as mongoose.Model<IUserLocation> | undefined) ??
    mongoose.model<IUserLocation>("UserLocation", userLocationSchema, "locations");