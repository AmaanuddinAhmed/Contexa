import "server-only";

import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
    email: string;
    /** Absent on accounts created with Google sign-in. */
    passwordHash?: string;
    googleId?: string;
    /** Google profile photo URL, kept for profile pictures. */
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

// Reuse the compiled model when Next.js reloads this module in development.
export const User =
    (mongoose.models.User as mongoose.Model<IUser> | undefined) ??
    mongoose.model<IUser>("User", userSchema);