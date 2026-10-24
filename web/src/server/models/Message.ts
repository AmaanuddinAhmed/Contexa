import "server-only";

import mongoose, { Document, Schema } from "mongoose";
import { MESSAGE_MAX_LENGTH } from "@/server/messages/rules";

export interface IMessage extends Document {
    connectionId: mongoose.Types.ObjectId;
    senderId: mongoose.Types.ObjectId;
    recipientId: mongoose.Types.ObjectId;
    body: string;
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
    { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ connectionId: 1, createdAt: -1 });
messageSchema.index({ recipientId: 1, readAt: 1 });
messageSchema.index({ senderId: 1, createdAt: -1 });

export const Message =
    (mongoose.models.Message as mongoose.Model<IMessage> | undefined) ??
    mongoose.model<IMessage>("Message", messageSchema);

export const toMessageView = (message: IMessage, userId: string) => ({
    id: String(message._id),
    connectionId: message.connectionId.toString(),
    senderId: message.senderId.toString(),
    body: message.body,
    createdAt: message.createdAt,
    mine: message.senderId.toString() === userId
});