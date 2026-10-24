import "server-only";

import mongoose, { Document, Schema } from "mongoose";

export interface IBlock extends Document {
    blockerId: mongoose.Types.ObjectId;
    blockedId: mongoose.Types.ObjectId;
    createdAt: Date;
}

const blockSchema = new Schema<IBlock>(
    {
        blockerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        blockedId: { type: Schema.Types.ObjectId, ref: "User", required: true }
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
blockSchema.index({ blockedId: 1 });

export const Block =
    (mongoose.models.Block as mongoose.Model<IBlock> | undefined) ??
    mongoose.model<IBlock>("Block", blockSchema);