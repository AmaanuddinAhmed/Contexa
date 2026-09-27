import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            CONTEXA
          </Link>

          <nav className="flex items-center gap-5 text-sm font-medium">
            <Link href="/profile" className="text-zinc-600 hover:text-black">
              Profile
            </Link>

            <Link href="/context" className="text-zinc-600 hover:text-black">
              Context
            </Link>

            <Link
              href="/recommendations"
              className="text-zinc-600 hover:text-black"
            >
              Recommendations
            </Link>

            <Link
              href="/login"
              className="rounded-lg bg-black px-4 py-2 text-white hover:bg-zinc-800"
            >
              Login
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-73px)] max-w-6xl items-center px-6 py-20">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Context-aware people ecosystem
          </p>

          <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
            Find people who fit your context.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
            CONTEXA uses profile information and your current context to
            discover and rank people based on compatibility.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/recommendations"
              className="rounded-xl bg-black px-6 py-3 font-medium text-white transition hover:bg-zinc-800"
            >
              View Recommendations
            </Link>

            <Link
              href="/context"
              className="rounded-xl border border-zinc-200 bg-white px-6 py-3 font-medium text-zinc-900 transition hover:bg-zinc-50"
            >
              Set Current Context
            </Link>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="text-sm font-semibold text-zinc-900">Profile</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Represent your skills, interests and experience.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="text-sm font-semibold text-zinc-900">Context</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Describe what you need and what you are doing right now.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="text-sm font-semibold text-zinc-900">Matching</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Receive ranked recommendations based on compatibility.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
