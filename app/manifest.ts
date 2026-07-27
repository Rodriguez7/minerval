import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Minerval — Rappels WhatsApp et paiements scolaires",
    short_name: "Minerval",
    description:
      "Rappels WhatsApp automatiques, paiements mobile money et suivi des frais scolaires pour les écoles de la RDC.",
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
