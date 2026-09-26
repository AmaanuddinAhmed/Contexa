import dotenv from "dotenv";
import { connectDatabase } from "./config/database.js";
import { Profile } from "./models/Profile.js";
import { Context } from "./models/Context.js";
import { calculateContextCompatibility } from "./services/contextMatchingService.js";

dotenv.config();

const testContextMatching = async (): Promise<void> => {
    await connectDatabase();

    const profiles = await Profile.find({
        visibility: "public"
    }).limit(10);

    if (profiles.length < 10) {
        throw new Error("Not enough profiles available.");
    }

    const userIds = profiles.map((profile) => profile.userId);

    const contexts = await Context.find({
        userId: { $in: userIds },
        isActive: true
    });

    if (contexts.length < 10) {
        throw new Error("Not enough active contexts available.");
    }

    const contextMap = new Map(
        contexts.map((context) => [
            context.userId.toString(),
            context
        ])
    );

    for (let i = 0; i < 5; i++) {
        const profileA = profiles[i];
        const profileB = profiles[i + 5];

        const contextA = contextMap.get(
            profileA.userId.toString()
        );

        const contextB = contextMap.get(
            profileB.userId.toString()
        );

        if (!contextA || !contextB) {
            throw new Error("Missing context for profile.");
        }

        const result = calculateContextCompatibility(
            profileA,
            profileB,
            contextA,
            contextB
        );

        console.log(
            `\n${profileA.name} ↔ ${profileB.name}`
        );

        console.log(result);

        if (result.score < 0 || result.score > 1) {
            throw new Error(
                "Invalid compatibility score."
            );
        }
    }

    console.log(
        "\nAll context-aware scores are within [0, 1]."
    );

    process.exit(0);
};

testContextMatching().catch((error) => {
    console.error(
        "Context matching test failed:",
        error
    );

    process.exit(1);
});