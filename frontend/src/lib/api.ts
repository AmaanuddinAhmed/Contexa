const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

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
        headers: {
            "Content-Type": "application/json",
            ...(token
                ? {
                    Authorization: `Bearer ${token}`
                }
                : {}),
            ...headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.error?.message || "Something went wrong."
        );
    }

    return data;
};