"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, useIsLoggedIn } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/profile", label: "Profile" },
  { href: "/context", label: "Context" },
  { href: "/recommendations", label: "Recommendations" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isLoggedIn = useIsLoggedIn();

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="text-xl font-bold tracking-tight">
          CONTEXA
        </Link>

        <nav className="flex flex-wrap items-center gap-5 text-sm font-medium">
          {isLoggedIn &&
            NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive ? "text-black" : "text-zinc-500 hover:text-black"
                  }
                >
                  {link.label}
                </Link>
              );
            })}

          {isLoggedIn ? (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-zinc-900 hover:bg-zinc-50"
            >
              Log out
            </button>
          ) : (
            <>
              <Link href="/login" className="text-zinc-500 hover:text-black">
                Log in
              </Link>

              <Link
                href="/register"
                className="rounded-lg bg-black px-4 py-2 text-white hover:bg-zinc-800"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
