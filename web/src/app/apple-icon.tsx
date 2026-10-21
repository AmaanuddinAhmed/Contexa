import { ImageResponse } from "next/og";
import { appIconDataUri } from "@/lib/appIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <img src={appIconDataUri("full-bleed")} width={180} height={180} alt="" />,
    size,
  );
}
