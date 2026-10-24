import "server-only";

import mongoose, { Document, Schema } from "mongoose";
import type { ExperimentRow, ExperimentSummary } from "@/server/evaluation/experiment";

export interface IExperiment extends Document {
    name: string;
    kind: "SYNTHETIC_COMPARISON";
    status: "running" | "completed" | "failed";
    params: {
        k: number;
        population: "synthetic" | "all";
        seed: number;
        variants: string[];
    };
    summary?: ExperimentSummary;
    rows: ExperimentRow[];
    notes: string[];
    error?: string;
    startedAt: Date;
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const experimentSchema = new Schema<IExperiment>(
    {
        name: { type: String, required: true, trim: true, maxlength: 200 },
        kind: { type: String, enum: ["SYNTHETIC_COMPARISON"], required: true },
        status: { type: String, enum: ["running", "completed", "failed"], default: "running" },
        params: {
            k: { type: Number, required: true },
            population: { type: String, enum: ["synthetic", "all"], required: true },
            seed: { type: Number, required: true },
            variants: { type: [String], required: true }
        },
        summary: { type: Schema.Types.Mixed },
        rows: { type: Schema.Types.Mixed, default: [] },
        notes: { type: [String], default: [] },
        error: { type: String },
        startedAt: { type: Date, required: true },
        completedAt: { type: Date }
    },
    { timestamps: true }
);

experimentSchema.index({ createdAt: -1 });

export const Experiment =
    (mongoose.models.Experiment as mongoose.Model<IExperiment> | undefined) ??
    mongoose.model<IExperiment>("Experiment", experimentSchema);