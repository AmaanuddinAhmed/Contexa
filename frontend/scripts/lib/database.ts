import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";

/** Loads .env / .env.local exactly as Next.js does, then connects. */
export const connectForScript = async (): Promise<void> => {
    loadEnvConfig(process.cwd());

    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is not defined (check frontend/.env.local).");
    }

    await mongoose.connect(mongoUri);
};