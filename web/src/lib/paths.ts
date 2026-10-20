/** Only same-site paths, e.g. "/context" (blocks "//evil.com" redirects). */
export const safeNextPath = (value: string | null | undefined): string | null =>
    value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
        ? value
        : null;