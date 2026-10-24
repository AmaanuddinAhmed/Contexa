import "server-only";

import mongoose from "mongoose";
import { Avatar } from "@/server/models/Avatar";
import { Block } from "@/server/models/Block";
import { Connection } from "@/server/models/Connection";
import { Context } from "@/server/models/Context";
import { FeedbackRound } from "@/server/models/FeedbackRound";
import { Message } from "@/server/models/Message";
import { Profile } from "@/server/models/Profile";
import { Report } from "@/server/models/Report";
import { User } from "@/server/models/User";
import { UserLocation } from "@/server/models/UserLocation";

export const deleteAccount = async (userId: string): Promise<void> => {
    const id = new mongoose.Types.ObjectId(userId);

    await User.updateOne({ _id: id }, { $set: { isActive: false } });

    await Promise.all([
        Profile.deleteMany({ userId: id }),
        Context.deleteMany({ userId: id }),
        UserLocation.deleteMany({ userId: id }),
        Avatar.deleteMany({ userId: id }),
        Message.deleteMany({ $or: [{ senderId: id }, { recipientId: id }] }),
        Connection.deleteMany({ $or: [{ requesterId: id }, { recipientId: id }] }),
        Block.deleteMany({ $or: [{ blockerId: id }, { blockedId: id }] }),
        Report.deleteMany({ reporterId: id }),
        FeedbackRound.deleteMany({ userId: id, status: { $ne: "completed" } })
    ]);

    await FeedbackRound.updateMany(
        { userId: id, status: "completed" },
        { $set: { userId: new mongoose.Types.ObjectId() } }
    );

    await User.deleteOne({ _id: id });
};