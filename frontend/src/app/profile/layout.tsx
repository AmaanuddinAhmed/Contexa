import RequireAuth from "@/components/RequireAuth";

export default function ProfileLayout({ children }: LayoutProps<"/profile">) {
  return <RequireAuth>{children}</RequireAuth>;
}
