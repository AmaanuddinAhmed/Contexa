import "server-only";

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
    matchTerms: string[];
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
            unique: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        bio: {
            type: String,
            trim: true,
        },
        education: {
            type: String,
            trim: true,
        },
        role: {
            type: String,
            trim: true,
        },
        experienceLevel: {
            type: String,
            trim: true,
        },
        skills: {
            type: [String],
            default: [],
        },
        interests: {
            type: [String],
            default: [],
        },
        collaborationPreferences: {
            type: [String],
            default: [],
        },
        // Normalised skills + interests, used only for indexed candidate
        // retrieval. Removed from API responses by the toJSON transform below.
        matchTerms: {
            type: [String],
            default: [],
        },
        visibility: {
            type: String,
            enum: ["public", "private"],
            default: "public",
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_document, json: Record<string, unknown>) => {
                delete json.matchTerms;
                return json;
            }
        }
    }
);

// Candidate retrieval: public profiles sharing at least one term.
profileSchema.index({ visibility: 1, matchTerms: 1 });

// Reuse the compiled model when Next.js reloads this module in development.
export const Profile =
    (mongoose.models.Profile as mongoose.Model<IProfile> | undefined) ??
    mongoose.model<IProfile>("Profile", profileSchema);
