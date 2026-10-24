import "server-only";

export const toMatchTerms = (values: readonly string[]): string[] => [
    ...new Set(
        values
            .map((value) => value.trim().toLowerCase())
            .filter((value) => value.length > 0)
    )
];