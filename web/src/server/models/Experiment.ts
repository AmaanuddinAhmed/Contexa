import "server-only";

import mongoose, { Document, Schema } from "mongoose";
import type { ExperimentRow, ExperimentSummary } from "@/server/evaluation/experiment";

/**
 * One run of the synthetic experiment (scripts/run-experiment.ts): the
 * settings, a summary, and every list it compared, so a run can be
 * re-analysed later without re-running it.
 */
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
        // Written once at the end of a run; stored as plain data.
        summary: { type: Schema.Types.Mixed },
        rows: { type: Schema.Types.Mixed, default: [] },
        notes: { type: [String], default: [] },
        error: { type: String },
        startedAt: { type: Date, required: true },
        completedAt: { type: Date }
    },
    { timestamps: true }
);

// The dashboard lists the newest runs first.
experimentSchema.index({ createdAt: -1 });

// Reuse the compiled model when Next.js reloads this module in development.
export const Experiment =
    (mongoose.models.Experiment as mongoose.Model<IExperiment> | undefined) ??
    mongoose.model<IExperiment>("Experiment", experimentSchema);