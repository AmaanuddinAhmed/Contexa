import "server-only";

import mongoose, { Document, Schema } from "mongoose";

/**
 * One blind feedback round: the pooled people shown to a user for one of
 * their contexts, and the 1-5 rating they gave each. See server/feedback/pool.ts.
 */
export interface IFeedbackItem {
    userId: mongoose.Types.ObjectId;
    /** Variant id -> 1-based rank that variant gave this person. */
    ranks: Map<string, number>;
    /** Variant id -> score that variant gave this person. */
    scores: Map<string, number>;
    rating?: number;
}

export interface IFeedbackRound extends Document {
    userId: mongoose.Types.ObjectId;
    /** The context the recommendations were generated for. */
    contextId: mongoose.Types.ObjectId;
    /** Term-matching method in use (semantic matching is added later). */
    matcher: "EXACT" | "SEMANTIC";
    /** How many people were taken from each variant. */
    k: number;
    items: IFeedbackItem[];
    status: "open" | "completed";
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const feedbackItemSchema = new Schema<IFeedbackItem>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        ranks: { type: Map, of: Number, required: true },
        scores: { type: Map, of: Number, required: true },
        rating: { type: Number, min: 1, max: 5 }
    },
    { _id: false }
);

const feedbackRoundSchema = new Schema<IFeedbackRound>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        contextId: { type: Schema.Types.ObjectId, ref: "Context", required: true },
        matcher: { type: String, enum: ["EXACT", "SEMANTIC"], default: "EXACT" },
        k: { type: Number, required: true },
        items: { type: [feedbackItemSchema], default: [] },
        status: { type: String, enum: ["open", "completed"], default: "open" },
        completedAt: { type: Date }
    },
    { timestamps: true }
);

// One round per user per context: rating the same context twice would
// double-count it. A new context allows a new round.
feedbackRoundSchema.index({ userId: 1, contextId: 1 }, { unique: true });
// Evaluation reads all completed rounds.
feedbackRoundSchema.index({ status: 1 });

// Reuse the compiled model when Next.js reloads this module in development.
export const FeedbackRound =
    (mongoose.models.FeedbackRound as mongoose.Model<IFeedbackRound> | undefined) ??
    mongoose.model<IFeedbackRound>("FeedbackRound", feedbackRoundSchema);