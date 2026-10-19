import ScanRadar from "@/components/ScanRadar";

/**
 * Frame for the login and register forms: the form on the left, the
 * radar (idle, slow) beside it on large screens only.
 */
export default function AuthShell({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <main className="page flex items-start lg:items-center">
      <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,460px)_1fr] lg:gap-20">
        <section className="panel animate-rise sm:p-9">
          <h1 className="font-display text-3xl font-semibold sm:text-[2.4rem] sm:leading-tight">
            {title}
          </h1>
          <p className="mt-2 text-muted">{lede}</p>
          <div className="mt-8">{children}</div>
        </section>

        <div className="hidden animate-rise justify-center [animation-delay:120ms] lg:flex">
          <ScanRadar
            speed={0.45}
            className="w-full max-w-[400px] drop-shadow-[0_30px_40px_rgba(34,56,201,0.14)]"
          />
        </div>
      </div>
    </main>
  );
}
