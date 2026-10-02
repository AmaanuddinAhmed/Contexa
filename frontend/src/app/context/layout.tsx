import RequireAuth from "@/components/RequireAuth";

export default function ContextLayout({ children }: LayoutProps<"/context">) {
  return <RequireAuth>{children}</RequireAuth>;
}
