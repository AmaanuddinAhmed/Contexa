import { clearToken } from "@/lib/auth";

const API_BASE_URL = "/api/v1";

interface ApiOptions extends RequestInit {
    token?: string;
}

export const api = async <T>(
    endpoint: string,
    options: ApiOptions = {}
): Promise<T> => {
    const { token, headers, ...fetchOptions } = options;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...fetchOptions,
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            ...headers
        }
    });

    if (response.status === 401 && token) {
        clearToken();
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(
            `/login?next=${encodeURIComponent(window.location.pathname)}`
        );
        throw new Error("Your session has expired. Please log in again.");
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.error?.message || "Something went wrong."
        );
    }

    return data;
};