import "server-only";

import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
    email: string;
    passwordHash?: string;
    googleId?: string;
    googlePicture?: string;
    role: "user" | "admin";
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
                passwordHash: {
            type: String
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true
        },
        googlePicture: {
            type: String
        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user"
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

export const User =
    (mongoose.models.User as mongoose.Model<IUser> | undefined) ??
    mongoose.model<IUser>("User", userSchema);