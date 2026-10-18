/**
 * Synthetic experiment: ranks every requester under all four variants
 * (PROFILE_ONLY / CONTEXT_AWARE x EXACT / SEMANTIC), once with their own
 * context and once with another user's context, and stores the lists and a
 * summary in the `experiments` collection. See src/server/evaluation/experiment.ts.
 *
 * Uses the same candidate generation and scoring service as the app, so the
 * recommendation service must be running (RECOMMENDATION_SERVICE_URL).
 *
 * Run from web/:
 *   npm run experiment
 *   npm run experiment -- --k=10 --population=all --seed=42 --name="After weight change"
 *   npm run experiment -- --matchers=EXACT       (if semantic matching is unavailable)
 */
import mongoose from "mongoose";
import {
    contextDonors,
    ExperimentRow,
    needCoverage,
    summariseExperiment
} from "../src/server/evaluation/experiment";
import { seededRandom } from "../src/server/evaluation/metrics";
import { Context, currentContextFilter, IContext } from "../src/server/models/Context";
import { Experiment } from "../src/server/models/Experiment";
import { IProfile, Profile } from "../src/server/models/Profile";
import { User } from "../src/server/models/User";
import {
    isMatcher,
    Matcher,
    MATCHERS,
    RECOMMENDATION_MODES,
    RecommendationMode,
    toVariantId
} from "../src/server/recommendations/modes";
import { rankForRequester } from "../src/server/recommendations/service";
import { connectForScript } from "./lib/database";

const SYNTHETIC_EMAIL = /@synthetic\.contexa\.local$/;
// Requesters processed at once; each makes up to 8 scoring calls.
const CONCURRENCY = 4;

const readArgs = () => {
    const args = new Map(
        process.argv.slice(2).map((arg) => {
            const [key, ...rest] = arg.replace(/^--/, "").split("=");
            return [key, rest.join("=")] as const;
        })
    );

    const k = Number(args.get("k") ?? 10);
    const seed = Number(args.get("seed") ?? 20261011);
    const population = (args.get("population") ?? "synthetic") as "synthetic" | "all";
    const matchers = (args.get("matchers") ?? MATCHERS.join(","))
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(isMatcher) as Matcher[];

    if (!Number.isInteger(k) || k < 1 || k > 50) {
        throw new Error("--k must be an integer from 1 to 50.");
    }

    if (!Number.isInteger(seed)) {
        throw new Error("--seed must be an integer.");
    }

    if (population !== "synthetic" && population !== "all") {
        throw new Error("--population must be synthetic or all.");
    }

    if (matchers.length === 0) {
        throw new Error("--matchers must list EXACT and/or SEMANTIC.");
    }

    return {
        k,
        seed,
        population,
        matchers,
        name: args.get("name") || `Synthetic comparison, K=${k}, ${new Date().toISOString().slice(0, 10)}`
    };
};

/** Requesters: users in the population with a public profile and a current context. */
const loadRequesters = async (population: "synthetic" | "all") => {
    const users = await User.find({ isActive: true }).select({ email: 1 }).lean();
    const ids = users
        .filter((user) => population === "all" || SYNTHETIC_EMAIL.test(user.email))
        .map((user) => user._id);

    const [profiles, contexts] = await Promise.all([
        Profile.find({ userId: { $in: ids }, visibility: "public" }),
        Context.find({ userId: { $in: ids }, ...currentContextFilter() }).sort({ createdAt: -1 })
    ]);

    // Newest current context per user (find() is sorted newest first).
    const contextByUser = new Map<string, IContext>();
    for (const context of contexts) {
        const key = context.userId.toString();
        if (!contextByUser.has(key)) {
            contextByUser.set(key, context);
        }
    }

    return profiles
        .filter((profile) => contextByUser.has(profile.userId.toString()))
        .sort((first, second) => first.userId.toString().localeCompare(second.userId.toString()))
        .map((profile) => ({ profile, context: contextByUser.get(profile.userId.toString())! }));
};

const runInBatches = async <T, R>(items: T[], size: number, work: (item: T) => Promise<R>) => {
    const results: R[] = [];

    for (let start = 0; start < items.length; start += size) {
        results.push(...(await Promise.all(items.slice(start, start + size).map(work))));
        process.stdout.write(`\r  ${Math.min(start + size, items.length)}/${items.length} requesters`);
    }

    process.stdout.write("\n");
    return results;
};

const percent = (value: number) => (Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "n/a");

const main = async () => {
    const { k, seed, population, matchers, name } = readArgs();
    await connectForScript();

    const variants = RECOMMENDATION_MODES.flatMap((mode) =>
        matchers.map((matcher) => ({ mode, matcher, id: toVariantId(mode, matcher) }))
    );

    const requesters = await loadRequesters(population);

    if (requesters.length < 2) {
        throw new Error(`Need at least 2 requesters in population "${population}", found ${requesters.length}.`);
    }

    const experiment = await Experiment.create({
        name,
        kind: "SYNTHETIC_COMPARISON",
        status: "running",
        params: { k, population, seed, variants: variants.map((variant) => variant.id) },
        startedAt: new Date()
    });

    console.log(`Experiment ${experiment.id}: ${requesters.length} requesters x ${variants.length} variants, K=${k}`);

    try {
        const contextOf = new Map(requesters.map((r) => [r.profile.userId.toString(), r.context]));
        const donors = contextDonors([...contextOf.keys()], seededRandom(seed));

        const rank = (profile: IProfile, context: IContext, mode: RecommendationMode, matcher: Matcher) =>
            rankForRequester(profile.userId, profile, context, k, mode, matcher);

        const rows = await runInBatches(requesters, CONCURRENCY, async ({ profile, context }) => {
            const userId = profile.userId.toString();
            const donorId = donors.get(userId)!;
            const row: ExperimentRow = { userId, swappedWith: donorId, lists: {}, swapped: {}, coverage: {} };

            for (const variant of variants) {
                const [own, swapped] = await Promise.all([
                    rank(profile, context, variant.mode, variant.matcher),
                    rank(profile, contextOf.get(donorId)!, variant.mode, variant.matcher)
                ]);

                row.lists[variant.id] = own.recommendations.map((r) => r.userId);
                row.swapped[variant.id] = swapped.recommendations.map((r) => r.userId);
                row.coverage[variant.id] = needCoverage(
                    context.need,
                    own.recommendations.flatMap((r) => [...r.profile.skills, ...r.profile.interests])
                );
            }

            return row;
        });

        const summary = summariseExperiment(rows, variants.map((variant) => variant.id), k);

        experiment.set({
            status: "completed",
            summary,
            rows,
            completedAt: new Date(),
            notes: [
                "Synthetic data describes system behaviour, not real-world relevance.",
                "Need coverage is circular for CONTEXT_AWARE, which optimises it directly; it is counted with exact terms.",
                "PROFILE_ONLY ignores context in scoring, so it should be unchanged after a context swap; any change comes from candidate retrieval."
            ]
        });
        await experiment.save();

        console.log("\nAgreement between variants (overlap@K, rank-biased overlap):");
        console.table(summary.agreement.map((pair) => ({
            first: pair.first, second: pair.second, overlap: percent(pair.overlap), rbo: percent(pair.rbo)
        })));
        console.log("Per variant:");
        console.table(summary.behaviour.map((variant) => ({
            variant: variant.variant,
            "same after context swap": percent(variant.sameAfterContextSwap),
            "need coverage": percent(variant.needCoverage)
        })));
    } catch (error) {
        experiment.set({ status: "failed", error: error instanceof Error ? error.message : String(error) });
        await experiment.save();
        throw error;
    }

    await mongoose.disconnect();
};

main().catch(async (error) => {
    console.error("Experiment failed:", error instanceof Error ? error.message : error);
    await mongoose.disconnect();
    process.exit(1);
});