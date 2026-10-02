import RequireAuth from "@/components/RequireAuth";

export default function RecommendationsLayout({
  children,
}: LayoutProps<"/recommendations">) {
  return <RequireAuth>{children}</RequireAuth>;
}
