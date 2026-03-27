import type { AppLocale } from "../config";

type PaymentCopy = {
  sharedForm: {
    providerLabel: string;
    providerPlaceholder: string;
    numberLabel: string;
    phonePlaceholder: string;
    payButtonLabel: string;
    successTitle: string;
    successDescription: string;
    errors: {
      paymentInProgress: string;
      paymentInProgressNumber: string;
      tooManyAttempts: string;
      paymentFailed: string;
      network: string;
    };
    processing: string;
  };
  access: {
    pageSubtitle: string;
    tooManyLookupAttempts: string;
    studentNotFound: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchButton: string;
    studentIdLabel: string;
    schoolFee: string;
    transactionFee: string;
    total: string;
    allPaid: string;
  };
  help: {
    title: string;
    description: string;
  };
  inactive: {
    title: string;
    description: string;
    cta: string;
  };
  receipt: {
    title: string;
    confirmed: string;
    pending: string;
    pendingDescription: string;
    student: string;
    studentId: string;
    class: string;
    amountPaid: string;
    provider: string;
    phone: string;
    transactionRef: string;
    reference: string;
    poweredBy: string;
    missingReference: string;
  };
};

export const PAYMENTS_COPY: Record<AppLocale, PaymentCopy> = {
  fr: {
    sharedForm: {
      providerLabel: "Operateur Mobile Money",
      providerPlaceholder: "Choisir un operateur…",
      numberLabel: "Numero Mobile Money",
      phonePlaceholder: "243812345678",
      payButtonLabel: "Payer",
      successTitle: "Paiement lance",
      successDescription:
        "Vous recevrez bientot une demande de confirmation sur votre telephone.",
      errors: {
        paymentInProgress:
          "Un paiement est deja en cours. Attendez 2 minutes puis reessayez.",
        paymentInProgressNumber:
          "Un paiement est deja en cours pour ce numero. Attendez 2 minutes puis reessayez.",
        tooManyAttempts: "Trop de tentatives. Reessayez plus tard.",
        paymentFailed: "Le paiement a echoue. Reessayez.",
        network: "Erreur reseau. Reessayez.",
      },
      processing: "Traitement…",
    },
    access: {
      pageSubtitle: "Paiement des frais scolaires",
      tooManyLookupAttempts:
        "Trop de recherches. Attendez {seconds} secondes puis reessayez.",
      studentNotFound: "Eleve introuvable. Verifiez l'identifiant et reessayez.",
      searchLabel: "Entrez votre ID eleve",
      searchPlaceholder: "ex. STU-001",
      searchButton: "Rechercher",
      studentIdLabel: "ID",
      schoolFee: "Frais scolaires",
      transactionFee: "Frais de transaction",
      total: "Total",
      allPaid: "Aucun frais en attente. Tout est regle !",
    },
    help: {
      title: "Minerval",
      description:
        "Utilisez le QR code ou le lien de paiement fourni par votre ecole pour commencer le paiement.",
    },
    inactive: {
      title: "Lien de paiement mis a jour",
      description:
        "Ce lien de paiement n'est plus actif. Scannez le dernier QR code ou demandez le lien actuel a votre ecole.",
      cta: "Retour a l'aide au paiement",
    },
    receipt: {
      title: "Recu de paiement",
      confirmed: "Paiement confirme",
      pending: "Paiement en attente",
      pendingDescription:
        "Votre paiement est en cours de traitement. Cette page affichera la confirmation une fois l'operation terminee.",
      student: "Eleve",
      studentId: "ID eleve",
      class: "Classe",
      amountPaid: "Montant paye",
      provider: "Operateur",
      phone: "Telephone",
      transactionRef: "Reference transaction",
      reference: "Reference",
      poweredBy: "Propulse par Minerval",
      missingReference: "Aucune reference de paiement fournie.",
    },
  },
  en: {
    sharedForm: {
      providerLabel: "Mobile Money Provider",
      providerPlaceholder: "Select provider…",
      numberLabel: "Mobile Money Number",
      phonePlaceholder: "243812345678",
      payButtonLabel: "Pay",
      successTitle: "Payment initiated",
      successDescription:
        "You will receive a confirmation prompt on your phone shortly.",
      errors: {
        paymentInProgress:
          "A payment is already in progress. Please wait 2 minutes and try again.",
        paymentInProgressNumber:
          "A payment is already in progress for this number. Please wait 2 minutes and try again.",
        tooManyAttempts: "Too many attempts. Please try again later.",
        paymentFailed: "Payment failed. Please try again.",
        network: "Network error. Please try again.",
      },
      processing: "Processing…",
    },
    access: {
      pageSubtitle: "School Fee Payment",
      tooManyLookupAttempts:
        "Too many lookup attempts. Please wait {seconds} seconds and try again.",
      studentNotFound: "Student not found. Check your ID and try again.",
      searchLabel: "Enter your Student ID",
      searchPlaceholder: "e.g. STU-001",
      searchButton: "Look up",
      studentIdLabel: "ID",
      schoolFee: "School fee",
      transactionFee: "Transaction fee",
      total: "Total",
      allPaid: "No outstanding fees. All paid!",
    },
    help: {
      title: "Minerval",
      description:
        "Please use the QR code or payment link provided by your school to start payment.",
    },
    inactive: {
      title: "Payment Link Updated",
      description:
        "This school payment link is no longer active. Please scan the latest QR code or request the current payment link from your school.",
      cta: "Return to Payment Help",
    },
    receipt: {
      title: "Payment Receipt",
      confirmed: "Payment confirmed",
      pending: "Payment pending",
      pendingDescription:
        "Your payment is being processed. This page will show the confirmation once complete.",
      student: "Student",
      studentId: "Student ID",
      class: "Class",
      amountPaid: "Amount paid",
      provider: "Provider",
      phone: "Phone",
      transactionRef: "Transaction ref",
      reference: "Reference",
      poweredBy: "Powered by Minerval",
      missingReference: "No payment reference provided.",
    },
  },
};

export function getPaymentsCopy(locale: AppLocale) {
  return PAYMENTS_COPY[locale];
}
