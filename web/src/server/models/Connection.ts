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
    /** Sorted "idA:idB": one record per pair, whoever sent the request. */
    pairKey: string;
    status: ConnectionStatus;
    message?: string;
    /**
 * Where the request came from, for evaluation: which recommendation mode
 * and matcher showed this person, at what rank and score. Absent if sent
 * elsewhere. `matcher` is absent on requests from before semantic
 * matching existed, which were all EXACT.
 */
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

// One record per pair; also stops two simultaneous requests creating duplicates.
connectionSchema.index({ pairKey: 1 }, { unique: true });
// Listing a user's requests and connections.
connectionSchema.index({ recipientId: 1, status: 1 });
connectionSchema.index({ requesterId: 1, status: 1 });

// Reuse the compiled model when Next.js reloads this module in development.
export const Connection =
    (mongoose.models.Connection as mongoose.Model<IConnection> | undefined) ??
    mongoose.model<IConnection>("Connection", connectionSchema);

/** The fields the connection rules check, with ids as strings. */
export const toRuleState = (connection: IConnection): ConnectionState => ({
    requesterId: connection.requesterId.toString(),
    recipientId: connection.recipientId.toString(),
    status: connection.status
});