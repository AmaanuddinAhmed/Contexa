import "server-only";
import mongoose from "mongoose";
import { Context, IContext } from "@/server/models/Context";
import { Profile, IProfile } from "@/server/models/Profile";
import { User } from "@/server/models/User";
import { toMatchTerms } from "./terms";

/**
 * Stage 1 of recommendation: candidate generation (retrieval).
 *
 * MODE-NEUTRAL BY CONSTRUCTION: this module takes no recommendation mode.
 * PROFILE_ONLY and CONTEXT_AWARE therefore always rank the same pool, so any
 * difference between them comes from scoring, not from who was retrieved.
 *
 * BOUNDED: returns at most CANDIDATE_POOL_LIMIT candidates, so the work in
 * stage 2 (scoring, in the Python service) does not grow with the user base.
 */

// The Python service accepts at most 500 candidates per request
// (MAX_CANDIDATES in recommendation-service/main.py).
const SCORER_MAX_CANDIDATES = 500;

export const getCandidatePoolLimit = (): number => {
    const configured = Number(process.env.CANDIDATE_POOL_LIMIT);

    if (!Number.isInteger(configured) || configured < 2) {
        return SCORER_MAX_CANDIDATES;
    }

    return Math.min(configured, SCORER_MAX_CANDIDATES);
};

// How many index matches each retrieval channel may examine before
// re-ranking. Bounds retrieval cost independently of the number of users.
const getScanLimit = (): number => {
    const configured = Number(process.env.CANDIDATE_SCAN_LIMIT);
    return Number.isInteger(configured) && configured > 0 ? configured : 5000;
};

export interface Candidate {
    userId: string;
    profile: IProfile;
    context: IContext;
}

export interface CandidatePool {
    candidates: Candidate[];
    /** "full": everyone eligible was scored. "retrieval": indexed channels. */
    strategy: "full" | "retrieval";
}

/** Public profiles other than the requester's. */
interface BaseProfileFilter {
    userId: { $ne: mongoose.Types.ObjectId };
    visibility: "public";
}

const uniqueIds = (ids: mongoose.Types.ObjectId[]): mongoose.Types.ObjectId[] => {
    const seen = new Set<string>();

    return ids.filter((id) => {
        const key = id.toString();

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
};

/** Number of distinct `terms` contained in `values`. */
const countShared = (terms: Set<string>, values: readonly string[] = []): number =>
    new Set(values.filter((value) => terms.has(value))).size;

/** Keeps the `count` highest-relevance ids (stable for equal relevance). */
const topByRelevance = (
    items: { userId: mongoose.Types.ObjectId; relevance: number }[],
    count: number
): mongoose.Types.ObjectId[] =>
    items
        .filter((item) => item.relevance > 0)
        .sort((first, second) => second.relevance - first.relevance)
        .slice(0, count)
        .map((item) => item.userId);

/**
 * Picks which candidate user ids to consider when the eligible population is
 * larger than the limit. A cascade: each channel uses an index to fetch at
 * most `scanLimit` matches, re-ranks them with a cheap relevance measure that
 * mirrors one component of the scorer, and keeps the best:
 *
 *  - similarity (half the slots): Jaccard overlap of skill/interest terms,
 *    like the profile-similarity score
 *  - complementarity (other half), interleaving two directions:
 *      A -> B: share of the requester's needs the candidate covers
 *              (like needFulfillmentA)
 *      B -> A: share of the candidate's needs the requester covers
 *              (like needFulfillmentB)
 *  - fill: most recently updated public profiles, if slots remain
 */
const retrieveCandidateIds = async (
    baseFilter: BaseProfileFilter,
    requesterId: mongoose.Types.ObjectId,
    requesterProfile: IProfile,
    requesterContext: IContext | null,
    limit: number
): Promise<mongoose.Types.ObjectId[]> => {
    const half = Math.floor(limit / 2);
    const scanLimit = getScanLimit();

    const profileTerms = toMatchTerms([
        ...requesterProfile.skills,
        ...requesterProfile.interests
    ]);
    const needTerms = toMatchTerms(requesterContext?.need ?? []);
    const profileTermSet = new Set(profileTerms);
    const needTermSet = new Set(needTerms);

    const scanProfiles = (terms: string[]) =>
        terms.length === 0
            ? Promise.resolve([])
            : Profile.find({ ...baseFilter, matchTerms: { $in: terms } })
                .sort({ _id: -1 })
                .limit(scanLimit)
                .select({ userId: 1, matchTerms: 1 })
                .lean();

    const [similarProfiles, fulfillingProfiles, needingContexts] = await Promise.all([
        scanProfiles(profileTerms),
        scanProfiles(needTerms),
        profileTerms.length === 0
            ? Promise.resolve([])
            : Context.find({
                isActive: true,
                userId: { $ne: requesterId },
                needTerms: { $in: profileTerms }
            })
                .sort({ _id: -1 })
                .limit(scanLimit)
                .select({ userId: 1, needTerms: 1 })
                .lean()
    ]);

    const similarityIds = topByRelevance(
        similarProfiles.map((profile) => {
            const shared = countShared(profileTermSet, profile.matchTerms);
            const union = profileTermSet.size + new Set(profile.matchTerms).size - shared;
            return { userId: profile.userId, relevance: union === 0 ? 0 : shared / union };
        }),
        half
    );

    const fulfilsRequesterIds = topByRelevance(
        fulfillingProfiles.map((profile) => ({
            userId: profile.userId,
            relevance: countShared(needTermSet, profile.matchTerms) / needTermSet.size
        })),
        half
    );

    const needsRequesterIds = topByRelevance(
        needingContexts.map((context) => ({
            userId: context.userId,
            relevance:
                countShared(profileTermSet, context.needTerms) /
                Math.max(new Set(context.needTerms).size, 1)
        })),
        half
    );

    // Interleave the two complementarity directions so both are represented.
    const complementarityIds: mongoose.Types.ObjectId[] = [];

    for (
        let index = 0;
        index < Math.max(fulfilsRequesterIds.length, needsRequesterIds.length);
        index++
    ) {
        if (fulfilsRequesterIds[index]) complementarityIds.push(fulfilsRequesterIds[index]);
        if (needsRequesterIds[index]) complementarityIds.push(needsRequesterIds[index]);
    }

    const chosen = uniqueIds([
        ...similarityIds,
        ...uniqueIds(complementarityIds)
    ]).slice(0, limit);

    if (chosen.length < limit) {
        const fill = await Profile.find({
            ...baseFilter,
            userId: { ...baseFilter.userId, $nin: chosen }
        })
            .sort({ updatedAt: -1 })
            .limit(limit - chosen.length)
            .select({ userId: 1 })
            .lean();

        chosen.push(...fill.map((profile) => profile.userId));
    }

    return chosen;
};

export const generateCandidates = async (
    requesterId: mongoose.Types.ObjectId,
    requesterProfile: IProfile,
    requesterContext: IContext | null
): Promise<CandidatePool> => {
    const limit = getCandidatePoolLimit();

    const baseFilter: BaseProfileFilter = {
        userId: { $ne: requesterId },
        visibility: "public"
    };

    // Public profile count is an upper bound on the eligible population.
    const publicProfileCount = await Profile.countDocuments(baseFilter);

    const strategy: CandidatePool["strategy"] =
        publicProfileCount <= limit ? "full" : "retrieval";

    const candidateProfiles =
        strategy === "full"
            ? await Profile.find(baseFilter)
            : await (async () => {
                const ids = await retrieveCandidateIds(
                    baseFilter,
                    requesterId,
                    requesterProfile,
                    requesterContext,
                    limit
                );
                const profiles = await Profile.find({
                    ...baseFilter,
                    userId: { $in: ids }
                });
                // Keep the retrieval order (find() does not preserve $in order).
                const order = new Map(ids.map((id, index) => [id.toString(), index]));
                return profiles.sort(
                    (first, second) =>
                        (order.get(first.userId.toString()) ?? 0) -
                        (order.get(second.userId.toString()) ?? 0)
                );
            })();

    const candidateUserIds = candidateProfiles.map((profile) => profile.userId);

    // Eligibility: the account is active and has an active context.
    const [activeUserIds, candidateContexts] = await Promise.all([
        User.find({ _id: { $in: candidateUserIds }, isActive: true }).distinct("_id"),
        Context.find({ userId: { $in: candidateUserIds }, isActive: true })
    ]);

    const activeUserIdSet = new Set(activeUserIds.map((id) => id.toString()));
    const contextMap = new Map<string, IContext>();

    for (const context of candidateContexts) {
        contextMap.set(context.userId.toString(), context);
    }

    const candidates: Candidate[] = [];

    for (const profile of candidateProfiles) {
        const userId = profile.userId.toString();
        const context = contextMap.get(userId);

        if (activeUserIdSet.has(userId) && context) {
            candidates.push({ userId, profile, context });
        }
    }

    return { candidates, strategy };
};