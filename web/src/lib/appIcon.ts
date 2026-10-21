export type IconShape = "rounded" | "full-bleed";

const MARK =
    '<circle cx="12.5" cy="17" r="6" fill="#3352ff"/>' +
    '<circle cx="19.5" cy="17" r="6" fill="none" stroke="#ffffff" stroke-width="2"/>' +
    '<circle cx="23.5" cy="8.5" r="2.6" fill="#ffb21f"/>';

export function appIconSvg(shape: IconShape): string {
    if (shape === "rounded") {
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
            '<rect width="32" height="32" rx="10" fill="#121530"/>' +
            MARK +
            "</svg>"
        );
    }

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 48 48">' +
        '<rect x="-8" y="-8" width="48" height="48" fill="#121530"/>' +
        MARK +
        "</svg>"
    );
}

export function appIconDataUri(shape: IconShape): string {
    return `data:image/svg+xml;base64,${Buffer.from(appIconSvg(shape)).toString("base64")}`;
}