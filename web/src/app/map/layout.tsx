import RequireAuth from "@/components/RequireAuth";

export default function MapLayout({ children }: LayoutProps<"/map">) {
  return <RequireAuth>{children}</RequireAuth>;
}
