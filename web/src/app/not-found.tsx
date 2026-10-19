import Link from "next/link";
import ScanRadar from "@/components/ScanRadar";

export default function NotFound() {
  return (
    <main className="page flex flex-col items-center justify-center text-center">
      <ScanRadar speed={0.5} className="w-40 sm:w-48" />
      <h1 className="mt-8 font-display text-3xl font-semibold sm:text-4xl">
        Nothing found at this address
      </h1>
      <p className="mt-3 max-w-md text-muted">
        The page may have moved, or the link has a typo.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Link href="/recommendations" className="btn btn-primary">
          See your matches
        </Link>
        <Link href="/" className="btn btn-quiet">
          Go to the home page
        </Link>
      </div>
    </main>
  );
}
