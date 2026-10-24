import mongoose from "mongoose";
import { User } from "../src/server/models/User";
import { connectForScript } from "./lib/database";

const main = async () => {
    const args = process.argv.slice(2);
    const email = args.find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();
    const revoke = args.includes("--revoke");

    if (!email) {
        throw new Error("Usage: npm run admin:grant -- <email> [--revoke]");
    }

    await connectForScript();

    const user = await User.findOneAndUpdate(
        { email },
        { $set: { role: revoke ? "user" : "admin" } },
        { returnDocument: "after" }
    );

    if (!user) {
        throw new Error(`No account with email ${email}.`);
    }

    console.log(`${user.email} is now ${user.role === "admin" ? "an admin" : "a regular user"}.`);
    await mongoose.disconnect();
};

main().catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await mongoose.disconnect();
    process.exit(1);
});