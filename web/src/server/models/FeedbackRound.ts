import "server-only";

import mongoose, { Document, Schema } from "mongoose";

export interface IFeedbackItem {
    userId: mongoose.Types.ObjectId;
    ranks: Map<string, number>;
    scores: Map<string, number>;
    rating?: number;
}

export interface IFeedbackRound extends Document {
    userId: mongoose.Types.ObjectId;
    contextId: mongoose.Types.ObjectId;
    matcher: "EXACT" | "SEMANTIC" | "BOTH";
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
        matcher: { type: String, enum: ["EXACT", "SEMANTIC", "BOTH"], default: "EXACT" },
        k: { type: Number, required: true },
        items: { type: [feedbackItemSchema], default: [] },
        status: { type: String, enum: ["open", "completed"], default: "open" },
        completedAt: { type: Date }
    },
    { timestamps: true }
);

feedbackRoundSchema.index({ userId: 1, contextId: 1 }, { unique: true });
feedbackRoundSchema.index({ status: 1 });

export const FeedbackRound =
    (mongoose.models.FeedbackRound as mongoose.Model<IFeedbackRound> | undefined) ??
    mongoose.model<IFeedbackRound>("FeedbackRound", feedbackRoundSchema);