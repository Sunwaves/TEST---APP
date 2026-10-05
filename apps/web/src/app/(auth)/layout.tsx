import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col items-center bg-gradient-to-b from-amber-50 to-stone-50 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <span aria-hidden className="inline-block size-4 rounded-full bg-amber-400" />
        Goldie Test App
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}
