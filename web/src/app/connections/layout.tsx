import RequireAuth from "@/components/RequireAuth";

export default function RecommendationsLayout({
  children,
}: LayoutProps<"/connections">) {
  return <RequireAuth>{children}</RequireAuth>;
}
