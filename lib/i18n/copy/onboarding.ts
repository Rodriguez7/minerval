import type { AppLocale } from "../config";

type OnboardingCopy = {
  actions: {
    validationError: string;
    invalidSchoolCode: string;
    invalidStudentIdPrefix: string;
    failedCheckAvailability: string;
    schoolCodeTaken: string;
    failedCreateSchool: string;
    failedCompleteSetup: string;
    failedUpdateBilling: string;
  };
  school: {
    step: string;
    title: string;
    description: string;
    nameLabel: string;
    codeLabel: string;
    codeHint: string;
    studentIdLabel: string;
    studentIdHint: string;
    currencyLabel: string;
    currencyFc: string;
    currencyUsd: string;
    submitPending: string;
    submit: string;
  };
  billing: {
    step: string;
    title: string;
    description: string;
    emailLabel: string;
    contactLabel: string;
    timezoneLabel: string;
    skip: string;
    submitPending: string;
    submit: string;
  };
  import: {
    step: string;
    title: string;
    description: string;
    skip: string;
  };
  done: {
    title: string;
    description: string;
    cta: string;
  };
  csvImport: {
    title: string;
    description: string;
    downloadTemplate: string;
    steps: [string, string, string];
    selectedFileHint: string;
    uploadPrompt: string;
    uploadSubprompt: string;
    errorSummary: string;
    moreErrors: string;
    readyToImport: string;
    importPending: string;
    importNow: string;
    successAlert: string;
    importFailed: string;
    networkError: string;
    linePrefix: string;
    templateFileName: string;
  };
};

export const ONBOARDING_COPY: Record<AppLocale, OnboardingCopy> = {
  fr: {
    actions: {
      validationError: "Erreur de validation.",
      invalidSchoolCode:
        "Utilisez uniquement des lettres minuscules, chiffres et tirets.",
      invalidStudentIdPrefix:
        "Utilisez 2 a 6 lettres majuscules ou chiffres (ex. ESM).",
      failedCheckAvailability:
        "Impossible de verifier la disponibilite du code ecole.",
      schoolCodeTaken: "Ce code ecole est deja utilise.",
      failedCreateSchool: "Impossible de creer l'ecole.",
      failedCompleteSetup:
        "Impossible de finaliser la configuration de l'ecole.",
      failedUpdateBilling:
        "Impossible de mettre a jour le contact de facturation.",
    },
    school: {
      step: "Etape 1 sur 3",
      title: "Configurez votre ecole",
      description:
        "Ces informations apparaitront sur les recus et les rapports.",
      nameLabel: "Nom de l'ecole",
      codeLabel: "Code ecole",
      codeHint:
        "Lettres minuscules, chiffres, tirets. Utilise dans l'URL de paiement.",
      studentIdLabel: "Prefixe ID eleve",
      studentIdHint:
        "2 a 6 lettres majuscules ou chiffres. Exemple : ESM-0001.",
      currencyLabel: "Devise",
      currencyFc: "FC — Franc congolais",
      currencyUsd: "USD — Dollar americain",
      submitPending: "Creation…",
      submit: "Continuer",
    },
    billing: {
      step: "Etape 2 sur 3",
      title: "Contact de facturation",
      description:
        "Utilise pour les factures et notifications de paiement.",
      emailLabel: "Email de facturation",
      contactLabel: "Nom du contact",
      timezoneLabel: "Fuseau horaire",
      skip: "Passer pour le moment",
      submitPending: "Enregistrement…",
      submit: "Continuer",
    },
    import: {
      step: "Etape 3 sur 3",
      title: "Importez vos eleves",
      description:
        "Importez un CSV pour ajouter votre liste d'eleves. Vous pourrez aussi le faire plus tard depuis la page Eleves.",
      skip: "Passer, j'ajouterai les eleves plus tard →",
    },
    done: {
      title: "Tout est pret !",
      description:
        "Votre ecole est configuree. Partagez votre QR code ou lien de paiement pour commencer a collecter les frais.",
      cta: "Ouvrir le tableau de bord",
    },
    csvImport: {
      title: "Importer des eleves depuis Excel / CSV",
      description:
        "Ajoutez plusieurs eleves a la fois en important un fichier tableur.",
      downloadTemplate: "Telecharger le modele",
      steps: [
        "Telechargez le modele",
        "Renseignez les noms et frais des eleves",
        "Importez le fichier ci-dessous",
      ],
      selectedFileHint: "Cliquez pour choisir un autre fichier",
      uploadPrompt: "Cliquez pour importer votre fichier",
      uploadSubprompt: "ou glissez-deposez-le ici",
      errorSummary: "Certaines lignes n'ont pas pu etre lues ({count}) :",
      moreErrors: "…et {count} de plus",
      readyToImport: "{count} eleve(s) pret(s) a importer",
      importPending: "Import en cours…",
      importNow: "Importer maintenant",
      successAlert: "{count} eleve(s) importe(s) avec succes.",
      importFailed: "Echec de l'import",
      networkError: "Erreur reseau. Reessayez.",
      linePrefix: "Ligne",
      templateFileName: "modele_eleves.csv",
    },
  },
  en: {
    actions: {
      validationError: "Validation error.",
      invalidSchoolCode: "Lowercase letters, numbers, hyphens only.",
      invalidStudentIdPrefix:
        "Use 2 to 6 uppercase letters or numbers (e.g. ESM).",
      failedCheckAvailability:
        "Failed to check school code availability.",
      schoolCodeTaken: "School code already taken.",
      failedCreateSchool: "Failed to create school.",
      failedCompleteSetup: "Failed to complete school setup.",
      failedUpdateBilling: "Failed to update billing contact.",
    },
    school: {
      step: "Step 1 of 3",
      title: "Set up your school",
      description:
        "This information appears on receipts and reports.",
      nameLabel: "School name",
      codeLabel: "School code",
      codeHint:
        "Lowercase letters, numbers, hyphens. Used in your payment link URL.",
      studentIdLabel: "Student ID prefix",
      studentIdHint:
        "2 to 6 uppercase letters or numbers. Student IDs will look like ESM-0001.",
      currencyLabel: "Currency",
      currencyFc: "FC — Congolese franc",
      currencyUsd: "USD — US dollar",
      submitPending: "Creating…",
      submit: "Continue",
    },
    billing: {
      step: "Step 2 of 3",
      title: "Billing contact",
      description: "Used for invoices and payment notifications.",
      emailLabel: "Billing email",
      contactLabel: "Contact name",
      timezoneLabel: "Timezone",
      skip: "Skip for now",
      submitPending: "Saving…",
      submit: "Continue",
    },
    import: {
      step: "Step 3 of 3",
      title: "Import your students",
      description:
        "Upload a CSV to add your student roster. You can also do this later from the Students page.",
      skip: "Skip, I'll add students later →",
    },
    done: {
      title: "You're all set!",
      description:
        "Your school is ready. Share your payment QR code or link to start collecting fees.",
      cta: "Go to Dashboard",
    },
    csvImport: {
      title: "Import Students from Excel / CSV",
      description:
        "Add many students at once by uploading a spreadsheet file.",
      downloadTemplate: "Download template",
      steps: [
        "Download the template",
        "Fill in student names and fees",
        "Upload the file below",
      ],
      selectedFileHint: "Click to choose a different file",
      uploadPrompt: "Click to upload your file",
      uploadSubprompt: "or drag and drop it here",
      errorSummary: "Some rows could not be read ({count}):",
      moreErrors: "…and {count} more",
      readyToImport: "{count} student(s) ready to import",
      importPending: "Importing…",
      importNow: "Import Now",
      successAlert: "Successfully imported {count} student(s).",
      importFailed: "Import failed",
      networkError: "Network error. Please try again.",
      linePrefix: "Line",
      templateFileName: "students_template.csv",
    },
  },
};

export function getOnboardingCopy(locale: AppLocale) {
  return ONBOARDING_COPY[locale];
}
