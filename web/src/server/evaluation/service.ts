import "server-only";
import { Connection } from "@/server/models/Connection";
import { Context, currentContextFilter } from "@/server/models/Context";
import { Experiment } from "@/server/models/Experiment";
import { FeedbackRound, IFeedbackRound } from "@/server/models/FeedbackRound";
import { Message } from "@/server/models/Message";
import { Profile } from "@/server/models/Profile";
import { User } from "@/server/models/User";
import {
    MATCHERS,
    RECOMMENDATION_MODES,
    toVariantId
} from "@/server/recommendations/modes";
import {
    compareVariants,
    Comparison,
    MIN_ROUNDS_TO_INTERPRET,
    RatedItem,
    RELEVANT_RATING,
    summariseVariant,
    VariantSummary
} from "./metrics";

const SYNTHETIC_EMAIL = /@synthetic\.contexa\.local$/;

export const VARIANTS = RECOMMENDATION_MODES.flatMap((mode) =>
    MATCHERS.map((matcher) => toVariantId(mode, matcher))
);

/**
 * The comparisons the evaluation reports, tested variant first. The first
 * one is the research question; the others isolate one change each.
 */
export const COMPARISONS: [string, string][] = [
    ["CONTEXT_AWARE", "PROFILE_ONLY"],
    ["CONTEXT_AWARE:SEMANTIC", "PROFILE_ONLY:SEMANTIC"],
    ["CONTEXT_AWARE:SEMANTIC", "CONTEXT_AWARE"],
    ["PROFILE_ONLY:SEMANTIC", "PROFILE_ONLY"]
];

/** A stored round's items as plain rated items (Mongoose Maps -> objects). */
const toRatedItems = (round: IFeedbackRound): RatedItem[] =>
    round.items
        .filter((item) => typeof item.rating === "number")
        .map((item) => ({
            rating: item.rating as number,
            ranks: Object.fromEntries(item.ranks instanceof Map ? item.ranks : Object.entries(item.ranks))
        }));

export interface ConnectionOutcome {
    variant: string;
    sent: number;
    accepted: number;
    declined: number;
    pending: number;
    /** accepted / (accepted + declined); NaN while none are answered. */
    acceptanceRate: number;
}

export interface Dashboard {
    overview: {
        realUsers: number;
        syntheticUsers: number;
        publicProfiles: number;
        currentContexts: number;
        connectionsPending: number;
        connectionsAccepted: number;
        messages: number;
        roundsOpen: number;
        roundsCompleted: number;
        raters: number;
        ratings: number;
    };
    feedback: {
        relevantRating: number;
        minRoundsToInterpret: number;
        variants: VariantSummary[];
        comparisons: Comparison[];
    };
    connections: ConnectionOutcome[];
}

export const loadDashboard = async (): Promise<Dashboard> => {
    const [users, publicProfiles, currentContexts, connections, messages, rounds] = await Promise.all([
        User.find().select({ email: 1 }).lean(),
        Profile.countDocuments({ visibility: "public" }),
        Context.countDocuments(currentContextFilter()),
        Connection.find().select({ status: 1, source: 1 }).lean(),
        Message.estimatedDocumentCount(),
        FeedbackRound.find()
    ]);

    const completed = rounds.filter((round) => round.status === "completed");
    const ratedRounds = completed.map(toRatedItems);
    const syntheticUsers = users.filter((user) => SYNTHETIC_EMAIL.test(user.email)).length;

    // Connection requests by the variant that showed the person.
    const outcomes = new Map<string, ConnectionOutcome>();

    for (const connection of connections) {
        const variant = connection.source
            ? toVariantId(connection.source.mode, connection.source.matcher ?? "EXACT")
            : "Not from recommendations";
        const outcome = outcomes.get(variant) ?? {
            variant, sent: 0, accepted: 0, declined: 0, pending: 0, acceptanceRate: NaN
        };

        outcome.sent++;
        outcome[connection.status]++;
        outcomes.set(variant, outcome);
    }

    for (const outcome of outcomes.values()) {
        const answered = outcome.accepted + outcome.declined;
        outcome.acceptanceRate = answered === 0 ? NaN : outcome.accepted / answered;
    }

    return {
        overview: {
            realUsers: users.length - syntheticUsers,
            syntheticUsers,
            publicProfiles,
            currentContexts,
            connectionsPending: connections.filter((c) => c.status === "pending").length,
            connectionsAccepted: connections.filter((c) => c.status === "accepted").length,
            messages,
            roundsOpen: rounds.length - completed.length,
            roundsCompleted: completed.length,
            raters: new Set(completed.map((round) => round.userId.toString())).size,
            ratings: ratedRounds.reduce((sum, items) => sum + items.length, 0)
        },
        feedback: {
            relevantRating: RELEVANT_RATING,
            minRoundsToInterpret: MIN_ROUNDS_TO_INTERPRET,
            variants: VARIANTS.map((variant) => summariseVariant(ratedRounds, variant)),
            comparisons: COMPARISONS.map(([variant, baseline]) =>
                compareVariants(ratedRounds, variant, baseline)
            )
        },
        connections: [...outcomes.values()].sort((first, second) =>
            first.variant.localeCompare(second.variant)
        )
    };
};

/** Experiment runs, newest first, without their per-user lists. */
export const listExperiments = async () =>
    Experiment.find().sort({ createdAt: -1 }).limit(20).select({ rows: 0 }).lean();

const csvCell = (value: unknown): string => {
    const text = value === undefined || value === null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Completed feedback as CSV, one row per (round, rated person, variant that
 * ranked them). Pseudonymous: user ids only, no names or emails.
 */
export const exportFeedbackCsv = async (): Promise<string> => {
    const rounds = await FeedbackRound.find({ status: "completed" }).sort({ completedAt: 1 });
    const lines = [
        ["roundId", "raterId", "contextId", "matcher", "completedAt", "personId", "rating", "variant", "rank", "score"].join(",")
    ];

    for (const round of rounds) {
        for (const item of round.items) {
            const ranks = item.ranks instanceof Map ? item.ranks : new Map(Object.entries(item.ranks));
            const scores = item.scores instanceof Map ? item.scores : new Map(Object.entries(item.scores));

            for (const [variant, rank] of ranks) {
                lines.push([
                    round.id, round.userId, round.contextId, round.matcher,
                    round.completedAt?.toISOString(), item.userId, item.rating,
                    variant, rank, scores.get(variant)
                ].map(csvCell).join(","));
            }
        }
    }

    return lines.join("\n") + "\n";
};