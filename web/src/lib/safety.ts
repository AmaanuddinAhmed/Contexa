/**
 * Block and report rules. Pure functions only (no database), so they can be
 * unit tested on their own; service.ts and the API routes apply them.
 *
 * Blocking is one-sided to create but works both ways: neither person sees
 * the other in recommendations, neither can send the other a request, and
 * any connection between them (with its messages) is removed. The blocked
 * person is not told. Reporting always blocks as well.
 */

export const REPORT_REASONS = [
    "spam",
    "harassment",
    "fake_profile",
    "inappropriate",
    "other"
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
    spam: "Spam or scam",
    harassment: "Harassment or abuse",
    fake_profile: "Fake profile",
    inappropriate: "Inappropriate content",
    other: "Something else"
};

export const REPORT_STATUSES = ["open", "reviewed"] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_DETAILS_MAX = 500;

/** Most recent messages between the two people attached to a report. */
export const REPORT_MESSAGES_KEPT = 20;

export type SafetyRuleResult =
    | { ok: true }
    | { ok: false; status: number; code: string; message: string };

/** May `userId` block or report `targetId`? Not themselves. */
export const checkSafetyTarget = (userId: string, targetId: string): SafetyRuleResult =>
    userId === targetId
        ? { ok: false, status: 400, code: "CANNOT_TARGET_SELF", message: "You cannot block or report yourself." }
        : { ok: true };

/** The other person in a block, seen from `userId`. */
export const otherPartyOf = (
    block: { blockerId: string; blockedId: string },
    userId: string
): string => (block.blockerId === userId ? block.blockedId : block.blockerId);

/** Ids to hide from `userId`: everyone they blocked and everyone who blocked them. */
export const hiddenUserIds = (
    blocks: { blockerId: string; blockedId: string }[],
    userId: string
): string[] => [...new Set(blocks.map((block) => otherPartyOf(block, userId)))];