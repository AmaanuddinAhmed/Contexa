import "server-only";

import {
    getRecommendationServiceTimeoutMs,
    getRecommendationServiceUrl
} from "./scoringClient";

export interface ServiceStatus {
    /** The service answered /health with a 2xx. */
    awake: boolean;
    /** How long the answer (or the give-up) took. */
    ms: number;
}

/** Calls the recommendation service's /health, which also wakes it if it was asleep. */
export const pingRecommendationService = async (): Promise<ServiceStatus> => {
    const started = Date.now();

    try {
        const response = await fetch(`${getRecommendationServiceUrl()}/health`, {
            cache: "no-store",
            signal: AbortSignal.timeout(getRecommendationServiceTimeoutMs())
        });

        return { awake: response.ok, ms: Date.now() - started };
    } catch {
        return { awake: false, ms: Date.now() - started };
    }
};