import "server-only";
import mongoose from "mongoose";
import { Context, currentContextFilter } from "@/server/models/Context";
import { FeedbackRound, IFeedbackRound } from "@/server/models/FeedbackRound";
import { Profile } from "@/server/models/Profile";
import {
    MATCHERS,
    RECOMMENDATION_MODES,
    toVariantId
} from "@/server/recommendations/modes";
import { getRecommendations } from "@/server/recommendations/service";
import { buildPool, checkRatings, VariantList } from "./pool";
import { avatarUrlsFor } from "@/server/avatars/service";

export const FEEDBACK_K = 5;

export interface FeedbackRoundView {
    roundId: string;
    status: "open" | "completed";
    people: {
        userId: string;
        name: string;
        bio?: string;
        role?: string;
        education?: string;
        experienceLevel?: string;
        skills: string[];
        interests: string[];
        collaborationPreferences: string[];
        avatarUrl: string | null;
    }[];
}

const toView = async (round: IFeedbackRound): Promise<FeedbackRoundView> => {
    const ids = round.items.map((item) => item.userId);
    const [profiles, avatarById] = await Promise.all([
        Profile.find({ userId: { $in: ids } }),
        avatarUrlsFor(ids)
    ]);
    const profileById = new Map(profiles.map((profile) => [profile.userId.toString(), profile]));

    return {
        roundId: String(round._id),
        status: round.status,
        people: round.items.map((item) => {
            const profile = profileById.get(item.userId.toString());

            return {
                userId: item.userId.toString(),
                name: profile?.name ?? "CONTEXA user",
                bio: profile?.bio,
                role: profile?.role,
                education: profile?.education,
                experienceLevel: profile?.experienceLevel,
                skills: profile?.skills ?? [],
                interests: profile?.interests ?? [],
                collaborationPreferences: profile?.collaborationPreferences ?? [],
                avatarUrl: avatarById.get(item.userId.toString()) ?? null
            };
        })
    };
};

export const startOrResumeRound = async (userId: string): Promise<FeedbackRoundView> => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("INVALID_USER_ID");
    }

    const context = await Context.findOne({ userId, ...currentContextFilter() }).sort({
        createdAt: -1
    });

    if (!context) {
        throw new Error("ACTIVE_CONTEXT_NOT_FOUND");
    }

    const existing = await FeedbackRound.findOne({ userId, contextId: context._id });

    if (existing?.status === "completed") {
        throw new Error("ALREADY_RATED");
    }

    if (existing) {
        return toView(existing);
    }

    const variants = RECOMMENDATION_MODES.flatMap((mode) =>
        MATCHERS.map((matcher) => ({ mode, matcher }))
    );

    const results = await Promise.allSettled(
        variants.map(async ({ mode, matcher }): Promise<VariantList> => ({
            variant: toVariantId(mode, matcher),
            recommendations: (await getRecommendations(userId, FEEDBACK_K, mode, matcher))
                .recommendations
        }))
    );

    const lists: VariantList[] = [];

    results.forEach((result, index) => {
        if (result.status === "fulfilled") {
            lists.push(result.value);
        } else if (variants[index].matcher === "EXACT") {
            throw result.reason;
        } else {
            console.error("Semantic variant skipped in feedback round:", result.reason);
        }
    });

    const pool = buildPool(lists, FEEDBACK_K);

    if (pool.length === 0) {
        throw new Error("NO_RECOMMENDATIONS");
    }

    try {
        const round = await FeedbackRound.create({
            userId,
            contextId: context._id,
            matcher: lists.length > RECOMMENDATION_MODES.length ? "BOTH" : "EXACT",
            k: FEEDBACK_K,
            items: pool.map((item) => ({
                userId: item.userId,
                ranks: item.ranks,
                scores: item.scores
            }))
        });

        return toView(round);
    } catch (error) {
        if ((error as { code?: number }).code === 11000) {
            const winner = await FeedbackRound.findOne({ userId, contextId: context._id });

            if (winner) {
                return toView(winner);
            }
        }

        throw error;
    }
};

export const submitRatings = async (
    userId: string,
    roundId: string,
    ratings: { userId: string; rating: number }[]
): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(roundId)) {
        throw new Error("ROUND_NOT_FOUND");
    }

    const round = await FeedbackRound.findOne({ _id: roundId, userId });

    if (!round) {
        throw new Error("ROUND_NOT_FOUND");
    }

    if (round.status === "completed") {
        throw new Error("ALREADY_SUBMITTED");
    }

    const check = checkRatings(
        round.items.map((item) => item.userId.toString()),
        ratings
    );

    if (!check.ok) {
        throw new Error(check.code);
    }

    const ratingById = new Map(ratings.map((entry) => [entry.userId, entry.rating]));

    const items = round.items.map((item) => ({
        userId: item.userId,
        ranks: item.ranks,
        scores: item.scores,
        rating: ratingById.get(item.userId.toString())
    }));

    const updated = await FeedbackRound.findOneAndUpdate(
        { _id: round._id, userId, status: "open" },
        { $set: { items, status: "completed", completedAt: new Date() } },
        { new: true, runValidators: true }
    );

    if (!updated) {
        throw new Error("ALREADY_SUBMITTED");
    }
};