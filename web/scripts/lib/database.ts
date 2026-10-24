import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";

export const connectForScript = async (): Promise<void> => {
    loadEnvConfig(process.cwd());

    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is not defined (check web/.env.local).");
    }

    await mongoose.connect(mongoUri);
};