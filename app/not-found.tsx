import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-blue-700">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">Page introuvable</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Le lien est peut-etre expire ou l&apos;adresse est incorrecte.
        </p>
        <Link href="/fr/" className="mt-6 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          Retour a l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
