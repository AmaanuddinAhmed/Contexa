import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: "/",
        name: "Contexa",
        short_name: "Contexa",
        description:
            "Find people to work with, ranked by your profile and what you need right now.",
        start_url: "/recommendations",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#eef0f5",
        theme_color: "#eef0f5",
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
            { name: "Matches", url: "/recommendations" },
            { name: "Messages", url: "/messages" },
            { name: "Map", url: "/map" },
        ],
    };
}