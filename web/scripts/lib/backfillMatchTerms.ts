import { Context } from "../../src/server/models/Context";
import { Profile } from "../../src/server/models/Profile";
import { toMatchTerms } from "../../src/server/recommendations/terms";

/**
 * Recomputes the normalised retrieval terms (Profile.matchTerms,
 * Context.needTerms) for every document. Safe to run repeatedly.
 */
export const backfillMatchTerms = async (): Promise<{
    profiles: number;
    contexts: number;
}> => {
    const profiles = await Profile.find().select({ skills: 1, interests: 1 }).lean();

    if (profiles.length > 0) {
        await Profile.bulkWrite(
            profiles.map((profile) => ({
                updateOne: {
                    filter: { _id: profile._id },
                    update: {
                        $set: {
                            matchTerms: toMatchTerms([
                                ...(profile.skills ?? []),
                                ...(profile.interests ?? [])
                            ])
                        }
                    },
                    // Keep updatedAt unchanged: this is maintenance, not a user edit.
                    timestamps: false
                }
            }))
        );
    }

    const contexts = await Context.find().select({ need: 1 }).lean();

    if (contexts.length > 0) {
        await Context.bulkWrite(
            contexts.map((context) => ({
                updateOne: {
                    filter: { _id: context._id },
                    update: { $set: { needTerms: toMatchTerms(context.need ?? []) } },
                    timestamps: false
                }
            }))
        );
    }

    return { profiles: profiles.length, contexts: contexts.length };
};