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

export const REPORT_MESSAGES_KEPT = 20;

export type SafetyRuleResult =
    | { ok: true }
    | { ok: false; status: number; code: string; message: string };

export const checkSafetyTarget = (userId: string, targetId: string): SafetyRuleResult =>
    userId === targetId
        ? { ok: false, status: 400, code: "CANNOT_TARGET_SELF", message: "You cannot block or report yourself." }
        : { ok: true };

export const otherPartyOf = (
    block: { blockerId: string; blockedId: string },
    userId: string
): string => (block.blockerId === userId ? block.blockedId : block.blockerId);

export const hiddenUserIds = (
    blocks: { blockerId: string; blockedId: string }[],
    userId: string
): string[] => [...new Set(blocks.map((block) => otherPartyOf(block, userId)))];