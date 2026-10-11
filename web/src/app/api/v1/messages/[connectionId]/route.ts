import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { authenticate } from "@/server/auth";
import { connectDatabase } from "@/server/db";
import { errorResponse, readJsonBody } from "@/server/http";
import {
    checkCanMessage,
    checkRateLimit,
    MESSAGE_PAGE_SIZE,
    MESSAGE_POLL_LIMIT,
    MESSAGE_RATE_LIMIT,
    otherParticipant
} from "@/server/messages/rules";
import { Connection, IConnection, toRuleState } from "@/server/models/Connection";
import { Message, toMessageView } from "@/server/models/Message";
import { messageQuerySchema, messageSchema } from "@/server/validation";

interface RouteContext {
    params: Promise<{ connectionId: string }>;
}

/**
 * Loads the connection and applies the messaging rules. Returns the
 * connection, or an error response the handler should return as-is.
 */
const loadConversation = async (
    connectionId: string,
    userId: string
): Promise<{ connection: IConnection } | { response: NextResponse }> => {
    const connection = mongoose.Types.ObjectId.isValid(connectionId)
        ? await Connection.findById(connectionId)
        : null;

    const rule = checkCanMessage(connection ? toRuleState(connection) : null, userId);

    if (!rule.ok) {
        return { response: errorResponse(rule.status, rule.code, rule.message) };
    }

    return { connection: connection! };
};

/**
 * Lists messages in a conversation, oldest first, and marks the caller's
 * unread messages as read.
 *
 *   (no query)       the latest page of history
 *   ?before=<time>   the page before that time (older history)
 *   ?after=<time>    messages at or after that time (polling). Inclusive, so
 *                    a message sent in the same millisecond is never missed;
 *                    the client drops the ones it already has by id.
 */
export const GET = async (request: Request, { params }: RouteContext) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    const searchParams = new URL(request.url).searchParams;
    const query = messageQuerySchema.safeParse({
        after: searchParams.get("after") ?? undefined,
        before: searchParams.get("before") ?? undefined
    });

    if (!query.success) {
        return errorResponse(400, "INVALID_QUERY", "Invalid message query.");
    }

    const { after, before } = query.data;

    try {
        await connectDatabase();

        const { connectionId } = await params;
        const loaded = await loadConversation(connectionId, auth.userId);

        if ("response" in loaded) {
            return loaded.response;
        }

        const conversation = { connectionId: loaded.connection._id };
        let messages;
        let hasMore = false;

        if (after) {
            messages = await Message.find({
                ...conversation,
                createdAt: { $gte: new Date(after) }
            })
                .sort({ createdAt: 1, _id: 1 })
                .limit(MESSAGE_POLL_LIMIT);
        } else {
            // One extra record tells us whether older history exists.
            const page = await Message.find({
                ...conversation,
                ...(before ? { createdAt: { $lt: new Date(before) } } : {})
            })
                .sort({ createdAt: -1, _id: -1 })
                .limit(MESSAGE_PAGE_SIZE + 1);

            hasMore = page.length > MESSAGE_PAGE_SIZE;
            messages = page.slice(0, MESSAGE_PAGE_SIZE).reverse();
        }

        // Opening a conversation reads everything in it. A poll writes only
        // when it brought something unread, so idle polling stays read-only.
        const openedConversation = !after && !before;
        const hasUnread = messages.some(
            (message) => message.recipientId.toString() === auth.userId && !message.readAt
        );

        if (openedConversation || hasUnread) {
            await Message.updateMany(
                { ...conversation, recipientId: auth.userId, readAt: { $exists: false } },
                { $set: { readAt: new Date() } }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                messages: messages.map((message) => toMessageView(message, auth.userId)),
                hasMore
            }
        });
    } catch (error) {
        console.error("List messages error:", error);
        return errorResponse(500, "MESSAGES_FETCH_FAILED", "Unable to load messages.");
    }
};

/** Sends a message. Body: { "body": "..." } */
export const POST = async (request: Request, { params }: RouteContext) => {
    const auth = authenticate(request);

    if ("response" in auth) {
        return auth.response;
    }

    const result = messageSchema.safeParse(await readJsonBody(request));

    if (!result.success) {
        return errorResponse(
            400,
            "INVALID_MESSAGE",
            "A message must be between 1 and 2000 characters."
        );
    }

    try {
        await connectDatabase();

        const { connectionId } = await params;
        const loaded = await loadConversation(connectionId, auth.userId);

        if ("response" in loaded) {
            return loaded.response;
        }

        const recentCount = await Message.countDocuments({
            senderId: auth.userId,
            createdAt: { $gt: new Date(Date.now() - MESSAGE_RATE_LIMIT.windowMs) }
        });

        const rate = checkRateLimit(recentCount);

        if (!rate.ok) {
            return errorResponse(rate.status, rate.code, rate.message);
        }

        const message = await Message.create({
            connectionId: loaded.connection._id,
            senderId: auth.userId,
            recipientId: otherParticipant(toRuleState(loaded.connection), auth.userId),
            body: result.data.body
        });

        return NextResponse.json(
            { success: true, data: { message: toMessageView(message, auth.userId) } },
            { status: 201 }
        );
    } catch (error) {
        console.error("Send message error:", error);
        return errorResponse(500, "MESSAGE_SEND_FAILED", "Unable to send message.");
    }
};