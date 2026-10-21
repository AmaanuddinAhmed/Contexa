import { ImageResponse } from "next/og";
import { appIconDataUri, IconShape } from "@/lib/appIcon";

const ICONS: Record<string, { size: number; shape: IconShape }> = {
  "icon-192.png": { size: 192, shape: "rounded" },
  "icon-512.png": { size: 512, shape: "rounded" },
  "maskable-512.png": { size: 512, shape: "full-bleed" },
};

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(
  _request: Request,
  context: RouteContext<"/icons/[name]">,
) {
  const { name } = await context.params;
  const icon = ICONS[name];

  if (!icon) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={appIconDataUri(icon.shape)}
      width={icon.size}
      height={icon.size}
      alt=""
    />,
    { width: icon.size, height: icon.size },
  );
}
