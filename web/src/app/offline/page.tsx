import type { Metadata } from "next";
import ScanRadar from "@/components/ScanRadar";
import ReloadButton from "@/components/ReloadButton";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <main className="page flex flex-col items-center justify-center text-center">
      <ScanRadar speed={0.5} className="w-40 sm:w-48" />
      <h1 className="mt-8 font-display text-3xl font-semibold sm:text-4xl">
        You&apos;re offline
      </h1>
      <p className="mt-3 max-w-md text-muted">
        Contexa needs a connection to load matches and messages. Check your
        connection and try again.
      </p>
      <div className="mt-7">
        <ReloadButton />
      </div>
    </main>
  );
}
