import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { hashPassword } from "../src/server/auth";
import { Connection } from "../src/server/models/Connection";
import { Context } from "../src/server/models/Context";
import { FeedbackRound } from "../src/server/models/FeedbackRound";
import { Message } from "../src/server/models/Message";
import { Profile } from "../src/server/models/Profile";
import { User } from "../src/server/models/User";
import { UserLocation } from "../src/server/models/UserLocation";
import { backfillMatchTerms } from "./lib/backfillMatchTerms";
import { buildSamples } from "./lib/buildSamples";
import { connectForScript } from "./lib/database";

const SAMPLE_USER_COUNT = 150;
const DEFAULT_SEED = 20261021;

const removePreviousSamples = async (): Promise<number> => {
    const ids = await User.find({
        email: { $regex: /@synthetic\.contexa\.local$/ }
    }).distinct("_id");

    if (ids.length === 0) {
        return 0;
    }

    await Promise.all([
        Context.deleteMany({ userId: { $in: ids } }),
        Profile.deleteMany({ userId: { $in: ids } }),
        UserLocation.deleteMany({ userId: { $in: ids } }),
        Message.deleteMany({ $or: [{ senderId: { $in: ids } }, { recipientId: { $in: ids } }] }),
        Connection.deleteMany({ $or: [{ requesterId: { $in: ids } }, { recipientId: { $in: ids } }] }),
        FeedbackRound.deleteMany({
            $or: [{ userId: { $in: ids } }, { status: "open", "items.userId": { $in: ids } }]
        })
    ]);
    await User.deleteMany({ _id: { $in: ids } });

    return ids.length;
};

const seed = async (): Promise<void> => {
    await connectForScript();

    const seedValue = Number(process.env.SYNTHETIC_SEED ?? DEFAULT_SEED);

    await Promise.all([User.init(), Profile.init(), Context.init()]);

    console.log("Removing previous sample users and their data...");
    const removed = await removePreviousSamples();
    console.log(`Removed ${removed} sample users.`);

    const passwordHash = await hashPassword(randomBytes(32).toString("hex"));

    console.log(`Generating ${SAMPLE_USER_COUNT} sample users (seed ${seedValue})...`);

    const { users, profiles, contexts } = buildSamples(SAMPLE_USER_COUNT, seedValue, passwordHash);

    await User.insertMany(users);
    await Profile.insertMany(profiles);
    await Context.insertMany(contexts);

    const backfilled = await backfillMatchTerms();

    console.log(
        `Created ${users.length} sample users (${contexts.length} with an active context).`
    );
    console.log(
        `Retrieval terms up to date for ${backfilled.profiles} profiles and ${backfilled.contexts} contexts.`
    );

    await mongoose.disconnect();
};

seed().catch(async (error) => {
    console.error("Seed failed:", error);
    await mongoose.disconnect();
    process.exit(1);
});