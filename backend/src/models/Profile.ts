import mongoose, { Document, Schema } from "mongoose";

export interface IProfile extends Document {
    userId: mongoose.Types.ObjectId;
    name: string;
    bio?: string;
    education?: string;
    role?: string;
    experienceLevel?: string;
    skills: string[];
    interests: string[];
    collaborationPreferences?: string[];
    visibility: "public" | "private";
    createdAt: Date;
    updatedAt: Date;
}

const profileSchema = new Schema<IProfile>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        bio: {
            type: String,
            trim: true
        },
        education: {
            type: String,
            trim: true
        },
        role: {
            type: String,
            trim: true
        },
        experienceLevel: {
            type: String,
            trim: true
        },
        skills: {
            type: [String],
            default: []
        },
        interests: {
            type: [String],
            default: []
        },
        collaborationPreferences: {
            type: [String],
            default: []
        },
        visibility: {
            type: String,
            enum: ["public", "private"],
            default: "public"
        }
    },
    {
        timestamps: true
    }
);

export const Profile = mongoose.model<IProfile>("Profile", profileSchema);