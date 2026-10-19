import { clearToken } from "@/lib/auth";

// Same origin: the API is served by this Next.js app (src/app/api/v1).
const API_BASE_URL = "/api/v1";

interface ApiOptions extends RequestInit {
    /**
     * The logged-in flag from getToken(). The session cookie is what
     * authenticates; this only tells api() that a 401 means "session
     * expired" (log out) rather than "wrong password" on the login page.
     */
    token?: string;
}

export const api = async <T>(
    endpoint: string,
    options: ApiOptions = {}
): Promise<T> => {
    const { token, headers, ...fetchOptions } = options;

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...fetchOptions,
        // Sends the httpOnly session cookie (same site only).
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            ...headers
        }
    });

    // A rejected token (expired, tampered, or the account removed): log out
    // and go to /login. Only when a token was sent, so a wrong password on
    // the login page still shows its normal error.
    if (response.status === 401 && token) {
        clearToken();
        // Not a component (no router here); a full reload also clears stale page state.
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