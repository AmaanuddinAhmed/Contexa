import "server-only";

import mongoose, { Document, Schema } from "mongoose";
import {
    REPORT_DETAILS_MAX,
    REPORT_REASONS,
    REPORT_STATUSES,
    ReportReason,
    ReportStatus
} from "@/lib/safety";
import { MESSAGE_MAX_LENGTH } from "@/server/messages/rules";

/** A user's report about another user, for an admin to review. */
export interface IReport extends Document {
    reporterId: mongoose.Types.ObjectId;
    reportedId: mongoose.Types.ObjectId;
    reason: ReportReason;
    details?: string;
    /**
     * The latest messages between the two (if they were connected), copied
     * at report time, because blocking deletes the conversation.
     */
    messages: { fromReporter: boolean; body: string; createdAt: Date }[];
    status: ReportStatus;
    reviewedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
    {
        reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        reportedId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        reason: { type: String, enum: REPORT_REASONS, required: true },
        details: { type: String, trim: true, maxlength: REPORT_DETAILS_MAX },
        messages: {
            type: [
                new Schema(
                    {
                        fromReporter: { type: Boolean, required: true },
                        body: { type: String, required: true, maxlength: MESSAGE_MAX_LENGTH },
                        createdAt: { type: Date, required: true }
                    },
                    { _id: false }
                )
            ],
            default: []
        },
        status: { type: String, enum: REPORT_STATUSES, default: "open" },
        reviewedAt: { type: Date }
    },
    { timestamps: true }
);

// Admin list: open reports first, newest first.
reportSchema.index({ status: 1, createdAt: -1 });
// One open report per reporter and person.
reportSchema.index({ reporterId: 1, reportedId: 1, status: 1 });

export const Report =
    (mongoose.models.Report as mongoose.Model<IReport> | undefined) ??
    mongoose.model<IReport>("Report", reportSchema);