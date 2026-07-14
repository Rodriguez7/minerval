import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Minerval — Paiements scolaires",
    short_name: "Minerval",
    description:
      "Collecte et suivi des frais scolaires par mobile money pour les ecoles de la RDC.",
    start_url: "/fr/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1d4ed8",
    lang: "fr-CD",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
