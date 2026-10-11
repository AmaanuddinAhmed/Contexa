import "server-only";

import mongoose, { Document, Schema } from "mongoose";
import { MESSAGE_MAX_LENGTH } from "@/server/messages/rules";

/**
 * One direct message between two connected users. A conversation is all the
 * messages of one connection record; removing the connection deletes them.
 */
export interface IMessage extends Document {
    connectionId: mongoose.Types.ObjectId;
    senderId: mongoose.Types.ObjectId;
    recipientId: mongoose.Types.ObjectId;
    body: string;
    /** When the recipient opened the conversation after it arrived. */
    readAt?: Date;
    createdAt: Date;
}

const messageSchema = new Schema<IMessage>(
    {
        connectionId: {
            type: Schema.Types.ObjectId,
            ref: "Connection",
            required: true
        },
        senderId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        recipientId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        body: {
            type: String,
            required: true,
            trim: true,
            maxlength: MESSAGE_MAX_LENGTH
        },
        readAt: {
            type: Date
        }
    },
    // Messages are never edited, so only createdAt is kept.
    { timestamps: { createdAt: true, updatedAt: false } }
);

// Loading a conversation (newest first) and polling for newer messages.
messageSchema.index({ connectionId: 1, createdAt: -1 });
// Unread counts for the header badge and the conversation list.
messageSchema.index({ recipientId: 1, readAt: 1 });
// Rate limit: a sender's messages in the last minute.
messageSchema.index({ senderId: 1, createdAt: -1 });

// Reuse the compiled model when Next.js reloads this module in development.
export const Message =
    (mongoose.models.Message as mongoose.Model<IMessage> | undefined) ??
    mongoose.model<IMessage>("Message", messageSchema);

/** What the API returns for one message. `mine` is relative to the caller. */
export const toMessageView = (message: IMessage, userId: string) => ({
    id: String(message._id),
    connectionId: message.connectionId.toString(),
    senderId: message.senderId.toString(),
    body: message.body,
    createdAt: message.createdAt,
    mine: message.senderId.toString() === userId
});