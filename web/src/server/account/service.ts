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

/**
 * Deletes an account and everything that belongs to it.
 *
 * Kept, without anything that identifies the person:
 *  - completed feedback rounds: their rater id is replaced by one random id
 *    (the same for all their rounds), so the experiment keeps its ratings
 *    and rater count. Open rounds are deleted.
 *  - reports filed ABOUT this person (moderation record); reports they
 *    filed are deleted.
 *
 * The account is deactivated first, so it disappears from matches straight
 * away even if a later step fails.
 */
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