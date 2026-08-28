import mongoose, { Document, Schema } from "mongoose";

export interface IContext extends Document {
    userId: mongoose.Types.ObjectId;
    goal: string;
    need: string[];
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
        timestamps: true
    }
);

export const Context = mongoose.model<IContext>("Context", contextSchema);