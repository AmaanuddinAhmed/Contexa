import "server-only";

import mongoose, { Document, Schema } from "mongoose";

export interface IContext extends Document {
    userId: mongoose.Types.ObjectId;
    goal: string;
    need: string[];
    needTerms: string[];
    activity: string;
    availability: string;
    situation: string;
    interactionPreference: string;
    isActive: boolean;
    validFrom: Date;
    validUntil?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const contextSchema = new Schema<IContext>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        goal: {
            type: String,
            required: true,
            trim: true
        },
        need: {
            type: [String],
            default: []
        },
        // Normalised needs, used only for indexed candidate retrieval.
        // Removed from API responses by the toJSON transform below.
        needTerms: {
            type: [String],
            default: []
        },
        activity: {
            type: String,
            required: true,
            trim: true
        },
        availability: {
            type: String,
            required: true,
            trim: true
        },
        situation: {
            type: String,
            required: true,
            trim: true
        },
        interactionPreference: {
            type: String,
            required: true,
            trim: true
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        validFrom: {
            type: Date,
            default: Date.now
        },
        validUntil: {
            type: Date
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_document, json: Record<string, unknown>) => {
                delete json.needTerms;
                return json;
            }
        }
    }
);

// Candidate retrieval: active contexts needing at least one term.
contextSchema.index({ isActive: 1, needTerms: 1 });
// Loading the active contexts of a set of candidates.
contextSchema.index({ userId: 1, isActive: 1 });

// Reuse the compiled model when Next.js reloads this module in development.
export const Context =
    (mongoose.models.Context as mongoose.Model<IContext> | undefined) ??
    mongoose.model<IContext>("Context", contextSchema);