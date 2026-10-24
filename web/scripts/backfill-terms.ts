import mongoose from "mongoose";
import { connectForScript } from "./lib/database";
import { backfillMatchTerms } from "./lib/backfillMatchTerms";

const main = async () => {
    await connectForScript();

    const updated = await backfillMatchTerms();
    console.log(
        `Backfilled terms for ${updated.profiles} profiles and ${updated.contexts} contexts.`
    );

    await mongoose.disconnect();
};

main().catch(async (error) => {
    console.error("Backfill failed:", error);
    await mongoose.disconnect();
    process.exit(1);
});