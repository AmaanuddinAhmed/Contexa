import "server-only";

import mongoose, { Document, Schema } from "mongoose";

export interface IUserLocation extends Document {
    userId: mongoose.Types.ObjectId;
    lat: number;
    lng: number;
    ghost: boolean;
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

userLocationSchema.index({ userId: 1 }, { unique: true });

export const UserLocation =
    (mongoose.models.UserLocation as mongoose.Model<IUserLocation> | undefined) ??
    mongoose.model<IUserLocation>("UserLocation", userLocationSchema, "locations");