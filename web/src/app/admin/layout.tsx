import RequireAuth from "@/components/RequireAuth";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <RequireAuth>{children}</RequireAuth>;
}
