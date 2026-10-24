import "server-only";

import {
    getRecommendationServiceTimeoutMs,
    getRecommendationServiceUrl
} from "./scoringClient";

export interface ServiceStatus {
    awake: boolean;
    ms: number;
}

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