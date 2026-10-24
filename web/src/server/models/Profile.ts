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
    isSample: boolean;
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
        matchTerms: {
            type: [String],
            default: [],
        },
        visibility: {
            type: String,
            enum: ["public", "private"],
            default: "public",
        },
        isSample: {
            type: Boolean,
            default: false,
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

profileSchema.index({ visibility: 1, matchTerms: 1 });

export const Profile =
    (mongoose.models.Profile as mongoose.Model<IProfile> | undefined) ??
    mongoose.model<IProfile>("Profile", profileSchema);
