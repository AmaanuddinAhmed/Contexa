import "server-only";
import mongoose from "mongoose";

const globalForMongoose = globalThis as typeof globalThis & {
    mongooseConnection?: Promise<typeof mongoose>;
};

export const connectDatabase = async (): Promise<typeof mongoose> => {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is not defined.");
    }

    if (!globalForMongoose.mongooseConnection) {
        globalForMongoose.mongooseConnection = mongoose
            .connect(mongoUri)
            .catch((error) => {
                globalForMongoose.mongooseConnection = undefined;
                throw error;
            });
    }

    return globalForMongoose.mongooseConnection;
};