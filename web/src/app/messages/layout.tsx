import RequireAuth from "@/components/RequireAuth";

export default function MessagesLayout({ children }: LayoutProps<"/messages">) {
  return <RequireAuth>{children}</RequireAuth>;
}
