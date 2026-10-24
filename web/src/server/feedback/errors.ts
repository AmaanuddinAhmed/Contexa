import "server-only";

export const FEEDBACK_ERRORS: Record<string, [number, string]> = {
    INVALID_USER_ID: [400, "Invalid user identifier."],
    PROFILE_NOT_FOUND: [404, "Create your profile before rating matches."],
    ACTIVE_CONTEXT_NOT_FOUND: [404, "Set your current context before rating matches."],
    ALREADY_RATED: [
        409,
        "You have already rated matches for this context. Update your context to rate again."
    ],
    NO_RECOMMENDATIONS: [404, "There is nobody to rate yet."],
    RECOMMENDATION_SERVICE_UNAVAILABLE: [
        503,
        "The recommendation engine is not available. Please try again shortly."
    ],
    ROUND_NOT_FOUND: [404, "Rating round not found."],
    ALREADY_SUBMITTED: [409, "These ratings have already been submitted."],
    UNKNOWN_PERSON: [400, "A rating is for someone not in this round."],
    DUPLICATE_RATING: [400, "Each person can be rated only once."],
    INVALID_RATING: [400, "Ratings must be whole numbers from 1 to 5."],
    INCOMPLETE_RATINGS: [400, "Please rate every person."]
};