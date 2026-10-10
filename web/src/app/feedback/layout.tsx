import RequireAuth from "@/components/RequireAuth";

export default function FeedbackLayout({ children }: LayoutProps<"/feedback">) {
  return <RequireAuth>{children}</RequireAuth>;
}
