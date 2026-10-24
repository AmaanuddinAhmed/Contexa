import "server-only";

import mongoose, { Document, Schema } from "mongoose";
import {
    Matcher,
    MATCHERS,
    RECOMMENDATION_MODES,
    RecommendationMode
} from "@/server/recommendations/modes";
import {
    CONNECTION_STATUSES,
    ConnectionState,
    ConnectionStatus
} from "@/server/connections/rules";

export interface IConnection extends Document {
    requesterId: mongoose.Types.ObjectId;
    recipientId: mongoose.Types.ObjectId;
    pairKey: string;
    status: ConnectionStatus;
    message?: string;
    source?: {
        mode: RecommendationMode;
        matcher?: Matcher;
        rank: number;
        score: number;
    };
    respondedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const connectionSchema = new Schema<IConnection>(
    {
        requesterId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        recipientId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        pairKey: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: CONNECTION_STATUSES,
            default: "pending"
        },
        message: {
            type: String,
            trim: true,
            maxlength: 300
        },
        source: {
            type: new Schema(
                {
                    mode: { type: String, enum: RECOMMENDATION_MODES, required: true },
                    matcher: { type: String, enum: MATCHERS },
                    rank: { type: Number, required: true },
                    score: { type: Number, required: true }
                },
                { _id: false }
            ),
            required: false
        },
        respondedAt: {
            type: Date
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_document, json: Record<string, unknown>) => {
                delete json.pairKey;
                return json;
            }
        }
    }
);

connectionSchema.index({ pairKey: 1 }, { unique: true });
connectionSchema.index({ recipientId: 1, status: 1 });
connectionSchema.index({ requesterId: 1, status: 1 });

export const Connection =
    (mongoose.models.Connection as mongoose.Model<IConnection> | undefined) ??
    mongoose.model<IConnection>("Connection", connectionSchema);

export const toRuleState = (connection: IConnection): ConnectionState => ({
    requesterId: connection.requesterId.toString(),
    recipientId: connection.recipientId.toString(),
    status: connection.status
});