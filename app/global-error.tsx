"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="fr">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
          <div className="max-w-md text-center">
            <p className="text-sm font-semibold text-red-700">Erreur</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">
              Un probleme est survenu
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Aucune operation ne doit etre relancee avant d&apos;avoir verifie son statut.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Reessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
