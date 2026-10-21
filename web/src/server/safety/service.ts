import "server-only";

import mongoose from "mongoose";
import { toPairKey } from "@/server/connections/rules";
import { Block } from "@/server/models/Block";
import { Connection } from "@/server/models/Connection";
import { Message } from "@/server/models/Message";
import { Report } from "@/server/models/Report";
import { hiddenUserIds, REPORT_MESSAGES_KEPT, ReportReason } from "@/lib/safety";

type Id = string | mongoose.Types.ObjectId;

const toObjectId = (id: Id) =>
    typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;

/** Everyone `userId` blocked or was blocked by. Call after connectDatabase(). */
export const hiddenUserIdsFor = async (userId: Id): Promise<mongoose.Types.ObjectId[]> => {
    const me = toObjectId(userId);
    const blocks = await Block.find({ $or: [{ blockerId: me }, { blockedId: me }] })
        .select({ blockerId: 1, blockedId: 1 })
        .lean();

    return hiddenUserIds(
        blocks.map((block) => ({
            blockerId: block.blockerId.toString(),
            blockedId: block.blockedId.toString()
        })),
        me.toString()
    ).map((id) => new mongoose.Types.ObjectId(id));
};

/** True if either person has blocked the other. */
export const isBlockedEitherWay = async (first: Id, second: Id): Promise<boolean> => {
    const a = toObjectId(first);
    const b = toObjectId(second);

    return (
        (await Block.exists({
            $or: [
                { blockerId: a, blockedId: b },
                { blockerId: b, blockedId: a }
            ]
        })) !== null
    );
};

/**
 * Blocks `blockedId` for `blockerId` (idempotent) and removes any
 * connection record between them, with its conversation.
 * Returns true if a new block was created.
 */
export const blockUser = async (blockerId: Id, blockedId: Id): Promise<boolean> => {
    const blocker = toObjectId(blockerId);
    const blocked = toObjectId(blockedId);

    const result = await Block.updateOne(
        { blockerId: blocker, blockedId: blocked },
        { $setOnInsert: { blockerId: blocker, blockedId: blocked } },
        { upsert: true }
    );

    const connection = await Connection.findOne({
        pairKey: toPairKey(blocker.toString(), blocked.toString())
    }).select({ _id: 1 });

    if (connection) {
        await Message.deleteMany({ connectionId: connection._id });
        await Connection.deleteOne({ _id: connection._id });
    }

    return result.upsertedCount > 0;
};

/** Removes `blockerId`'s block on `blockedId`. Returns false if there was none. */
export const unblockUser = async (blockerId: Id, blockedId: Id): Promise<boolean> => {
    const result = await Block.deleteOne({
        blockerId: toObjectId(blockerId),
        blockedId: toObjectId(blockedId)
    });

    return result.deletedCount > 0;
};

/**
 * Files a report and blocks the person. The latest messages between them
 * are copied into the report first, because blocking deletes them.
 */
export const reportUser = async (
    reporterId: Id,
    reportedId: Id,
    reason: ReportReason,
    details: string | undefined
) => {
    const reporter = toObjectId(reporterId);
    const reported = toObjectId(reportedId);

    const connection = await Connection.findOne({
        pairKey: toPairKey(reporter.toString(), reported.toString()),
        status: "accepted"
    }).select({ _id: 1 });

    const recent = connection
        ? await Message.find({ connectionId: connection._id })
            .sort({ createdAt: -1 })
            .limit(REPORT_MESSAGES_KEPT)
            .lean()
        : [];

    const report = await Report.create({
        reporterId: reporter,
        reportedId: reported,
        reason,
        details: details || undefined,
        messages: recent.reverse().map((message) => ({
            fromReporter: message.senderId.equals(reporter),
            body: message.body,
            createdAt: message.createdAt
        }))
    });

    await blockUser(reporter, reported);

    return report;
};