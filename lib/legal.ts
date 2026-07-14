import type { AppLocale } from "./i18n/config";

export const LEGAL_VERSION = "2026-07-14";

export const REQUIRED_LEGAL_ENV = [
  "LEGAL_ENTITY_NAME",
  "LEGAL_ENTITY_ADDRESS",
  "LEGAL_CONTACT_EMAIL",
  "PRIVACY_CONTACT_EMAIL",
] as const;

export function getLegalOperator() {
  return {
    name: process.env.LEGAL_ENTITY_NAME?.trim() || "Minerval",
    address: process.env.LEGAL_ENTITY_ADDRESS?.trim() || null,
    contactEmail:
      process.env.LEGAL_CONTACT_EMAIL?.trim() || "support@minerval.org",
    privacyEmail:
      process.env.PRIVACY_CONTACT_EMAIL?.trim() || "privacy@minerval.org",
  };
}

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

export type LegalDocument = {
  title: string;
  description: string;
  updatedLabel: string;
  sections: LegalSection[];
};

type LegalDocumentKind = "privacy" | "terms" | "refunds";

const LEGAL_COPY: Record<AppLocale, Record<LegalDocumentKind, LegalDocument>> = {
  fr: {
    privacy: {
      title: "Politique de confidentialite",
      description:
        "Comment Minerval collecte, utilise, partage, conserve et protege les donnees personnelles.",
      updatedLabel: "Version en vigueur",
      sections: [
        {
          title: "1. Responsabilites",
          paragraphs: [
            "L'ecole decide quelles donnees d'eleves sont enregistrees et pourquoi. Pour ces donnees, Minerval agit pour le compte de l'ecole. Minerval determine directement le traitement des donnees de compte, d'abonnement, de securite et de fonctionnement de la plateforme.",
            "Les comptes sont destines aux representants autorises des etablissements. Les eleves mineurs ne creent pas de compte Minerval. L'ecole doit disposer de l'autorite necessaire pour transmettre les donnees des eleves et informer les parents ou responsables legaux.",
          ],
        },
        {
          title: "2. Donnees traitees",
          items: [
            "Donnees de l'etablissement et de ses utilisateurs : nom, email, role, coordonnees, informations d'inscription et d'abonnement.",
            "Donnees des eleves : nom, identifiant scolaire, classe, niveau, montant des frais et situation de paiement.",
            "Donnees du payeur et de transaction : numero de telephone, operateur mobile money, montant, statut, references et recu. Minerval ne demande jamais le code PIN mobile money.",
            "Donnees techniques et de securite : adresse IP, appareil, journaux d'acces, erreurs et traces d'audit.",
          ],
        },
        {
          title: "3. Finalites",
          items: [
            "Creer et securiser les comptes, gerer les autorisations et fournir le service demande.",
            "Initier, confirmer, rapprocher et reverser les paiements, produire les recus et prevenir la fraude.",
            "Gerer les abonnements, fournir l'assistance, diagnostiquer les incidents et respecter les obligations legales.",
            "Ameliorer la fiabilite du service a partir de statistiques agregees et de journaux techniques.",
          ],
        },
        {
          title: "4. Destinataires et prestataires",
          paragraphs: [
            "Les donnees ne sont pas vendues. Elles sont accessibles aux utilisateurs autorises de l'ecole et, lorsque necessaire, aux prestataires qui assurent l'hebergement, la base de donnees, les paiements mobile money, les abonnements, les emails et la surveillance technique. Ceux-ci comprennent actuellement Supabase, Railway, SerdiPay, Stripe, Resend et l'infrastructure proxy de paiement de Minerval.",
            "Certains prestataires peuvent traiter des donnees en dehors de la RDC. Minerval limite les donnees transmises, applique des controles d'acces et utilise des engagements contractuels adaptes au service concerne.",
          ],
        },
        {
          title: "5. Conservation",
          paragraphs: [
            "Les donnees sont conservees pendant la duree du compte et aussi longtemps que necessaire pour fournir le service, regler un litige, assurer la securite ou satisfaire une obligation comptable ou legale. Les donnees sans obligation de conservation sont supprimees ou anonymisees apres une demande valide et la fin des delais techniques de sauvegarde.",
            "Les registres de paiement, de reversement et d'audit peuvent etre conserves plus longtemps que le compte afin de proteger les ecoles, les payeurs et Minerval et de satisfaire les exigences financieres applicables.",
          ],
        },
        {
          title: "6. Vos droits",
          paragraphs: [
            "Selon votre situation, vous pouvez demander l'acces, la rectification, la mise a jour, l'opposition, la limitation ou la suppression de vos donnees. Pour les donnees d'un eleve, contactez d'abord son ecole afin qu'elle puisse verifier l'identite et l'autorite du demandeur. Minerval peut conserver les elements qu'une obligation legale ou la prevention de la fraude impose de garder.",
          ],
        },
        {
          title: "7. Securite et incidents",
          paragraphs: [
            "Minerval utilise des controles d'acces, le chiffrement en transit, des journaux d'audit, des sauvegardes et une surveillance des incidents. Aucun systeme n'est infaillible. En cas d'incident affectant des donnees personnelles, Minerval evalue le risque, limite l'incident et informe les parties concernees lorsque cela est requis.",
          ],
        },
        {
          title: "8. Contact",
          paragraphs: [
            "Pour une question ou une demande relative aux donnees personnelles, utilisez l'adresse de confidentialite indiquee ci-dessous. Une verification d'identite ou d'autorite peut etre demandee avant toute communication ou suppression.",
          ],
        },
      ],
    },
    terms: {
      title: "Conditions d'utilisation",
      description:
        "Regles applicables aux etablissements, utilisateurs, payeurs et services Minerval.",
      updatedLabel: "Version en vigueur",
      sections: [
        {
          title: "1. Acceptation et autorite",
          paragraphs: [
            "En creant un compte ou en utilisant Minerval, vous acceptez ces conditions. La personne qui inscrit une ecole confirme etre autorisee a engager l'etablissement et a gerer les donnees et paiements concernes.",
          ],
        },
        {
          title: "2. Service",
          paragraphs: [
            "Minerval fournit des outils de gestion des eleves, de collecte des frais scolaires, de rapprochement, de rapports et de reversement. Les services mobile money, bancaires et d'abonnement sont aussi soumis aux regles et a la disponibilite des prestataires concernes.",
          ],
        },
        {
          title: "3. Comptes et securite",
          items: [
            "Fournir des informations exactes, maintenir les roles a jour et proteger les identifiants de connexion.",
            "Informer rapidement Minerval en cas d'acces suspect, d'erreur de paiement ou de changement de representant autorise.",
            "Ne pas partager les donnees d'eleves au-dela de ce qui est necessaire et autorise.",
          ],
        },
        {
          title: "4. Tarifs et commissions",
          paragraphs: [
            "Avant confirmation, l'ecran de paiement affiche le montant des frais scolaires, la commission Minerval de 3% ajoutee au payeur et le total a debiter. Lors d'un reversement, une commission Minerval de 3% est deduite du montant demande par l'ecole et le montant net est affiche avant validation.",
            "Les abonnements logiciels sont affiches en dollars americains : Growth a 29 USD par mois et Pro a 99 USD par mois, apres l'eventuel essai indique au moment de la souscription. Les taxes, frais de change ou frais propres a un prestataire peuvent s'appliquer lorsqu'ils sont annonces par celui-ci. Tout changement futur de tarif doit etre affiche avant de s'appliquer.",
          ],
        },
        {
          title: "5. Paiements et reversements",
          paragraphs: [
            "Un statut initie ou en traitement ne prouve pas qu'un paiement est definitif. La confirmation du prestataire et l'enregistrement du reglement font foi dans Minerval. Les reversements peuvent etre suspendus pendant une verification de securite, de conformite, de solde ou d'identite.",
          ],
        },
        {
          title: "6. Utilisations interdites",
          items: [
            "Utiliser le service pour une activite illegale, frauduleuse ou sans autorisation de l'etablissement.",
            "Contourner les controles de securite, falsifier des donnees ou perturber la plateforme.",
            "Utiliser les donnees d'eleves, de parents ou d'utilisateurs a des fins etrangeres a la gestion scolaire autorisee.",
          ],
        },
        {
          title: "7. Disponibilite et responsabilite",
          paragraphs: [
            "Minerval cherche a maintenir un service fiable, mais des interruptions peuvent resulter de la maintenance, des reseaux telecom, du mobile money, d'Internet ou d'un cas de force majeure. Dans les limites permises par la loi, Minerval n'est pas responsable d'un retard ou d'un echec directement cause par un prestataire externe ou par des informations incorrectes fournies par l'utilisateur.",
          ],
        },
        {
          title: "8. Suspension et fin du service",
          paragraphs: [
            "Un compte peut etre suspendu pour risque de fraude, atteinte a la securite, impaye d'abonnement ou violation substantielle de ces conditions. L'ecole peut demander la fermeture de son compte, sous reserve du reglement des paiements, reversements et obligations de conservation en cours.",
          ],
        },
        {
          title: "9. Droit applicable et contact",
          paragraphs: [
            "Ces conditions sont regies par le droit de la Republique democratique du Congo. Les parties cherchent d'abord une solution amiable. Les juridictions competentes de la RDC restent applicables lorsqu'aucun accord n'est trouve.",
          ],
        },
      ],
    },
    refunds: {
      title: "Annulations, remboursements et contestations",
      description:
        "Procedure applicable aux abonnements Minerval et aux paiements de frais scolaires.",
      updatedLabel: "Version en vigueur",
      sections: [
        {
          title: "1. Abonnements des ecoles",
          paragraphs: [
            "Une ecole peut gerer ou annuler son abonnement depuis le portail de facturation. L'annulation prend normalement effet a la fin de la periode deja payee, sauf indication differente affichee dans le portail. Les frais deja factures ne sont pas automatiquement rembourses.",
            "Une demande motivee liee a une double facturation, une erreur technique ou une indisponibilite importante peut etre examinee au cas par cas. Elle doit inclure l'email du compte, la facture et la date concernee.",
          ],
        },
        {
          title: "2. Frais scolaires payes par mobile money",
          paragraphs: [
            "Minerval facilite le paiement pour le compte de l'ecole. L'ecole reste responsable de la decision concernant le remboursement des frais scolaires. Le payeur doit contacter l'ecole indiquee sur le recu et fournir la reference de paiement, le numero utilise, le montant et la raison de la demande.",
            "Ne relancez pas immediatement un paiement affiche en traitement : attendez sa confirmation ou son echec afin d'eviter un double debit. En cas de double debit ou de debit sans recu confirme, contactez l'ecole et Minerval sans partager votre code PIN.",
          ],
        },
        {
          title: "3. Commission et delai",
          paragraphs: [
            "La commission affichee avant paiement couvre le traitement du service. Son remboursement depend de la cause, du statut de la transaction et des frais deja engages aupres du prestataire. Une demande n'est acceptee qu'apres verification de la transaction et de l'identite ou de l'autorite du demandeur.",
            "Le delai effectif depend de l'ecole et de l'operateur mobile money. Minerval ne peut pas garantir un delai bancaire ou telecom precis, mais communique le suivi disponible.",
          ],
        },
        {
          title: "4. Contestations",
          paragraphs: [
            "Pour contester une operation, envoyez la reference de transaction, la date, le montant, l'ecole et les quatre derniers chiffres du numero payeur. N'envoyez jamais de code PIN, mot de passe ou code a usage unique. Une contestation frauduleuse peut entrainer la suspension du compte ou du paiement.",
          ],
        },
      ],
    },
  },
  en: {
    privacy: {
      title: "Privacy Policy",
      description:
        "How Minerval collects, uses, shares, retains, and protects personal data.",
      updatedLabel: "Effective version",
      sections: [
        {
          title: "1. Responsibilities",
          paragraphs: [
            "The school decides which student data is recorded and why. Minerval processes that data on the school's behalf. Minerval directly determines the processing of account, subscription, security, and platform operations data.",
            "Accounts are for authorized institution representatives. Minor students do not create Minerval accounts. The school must have authority to provide student data and inform parents or legal guardians.",
          ],
        },
        {
          title: "2. Data we process",
          items: [
            "Institution and user data: name, email, role, contact details, registration, and subscription information.",
            "Student data: name, school identifier, class, level, fee amount, and payment position.",
            "Payer and transaction data: phone number, mobile-money network, amount, status, references, and receipt. Minerval never asks for a mobile-money PIN.",
            "Technical and security data: IP address, device, access logs, errors, and audit trails.",
          ],
        },
        {
          title: "3. Purposes",
          items: [
            "Create and secure accounts, manage permissions, and provide the requested service.",
            "Initiate, confirm, reconcile, and pay out transactions, produce receipts, and prevent fraud.",
            "Manage subscriptions, provide support, diagnose incidents, and meet legal obligations.",
            "Improve service reliability using aggregated statistics and technical logs.",
          ],
        },
        {
          title: "4. Recipients and service providers",
          paragraphs: [
            "Data is not sold. It is available to authorized school users and, where necessary, providers supporting hosting, databases, mobile-money payments, subscriptions, email, and technical monitoring. These currently include Supabase, Railway, SerdiPay, Stripe, Resend, and Minerval's payment proxy infrastructure.",
            "Some providers may process data outside the DRC. Minerval limits the data shared, applies access controls, and uses contractual commitments appropriate to the relevant service.",
          ],
        },
        {
          title: "5. Retention",
          paragraphs: [
            "Data is kept for the life of the account and as long as necessary to provide the service, resolve disputes, maintain security, or meet accounting and legal duties. Data with no continuing retention requirement is deleted or anonymized after a valid request and the end of technical backup periods.",
            "Payment, payout, and audit records may be kept longer than the account to protect schools, payers, and Minerval and to meet applicable financial requirements.",
          ],
        },
        {
          title: "6. Your rights",
          paragraphs: [
            "Depending on your situation, you may request access, correction, updating, objection, restriction, or deletion. For student data, contact the student's school first so it can verify the requester's identity and authority. Minerval may retain information required by law or fraud prevention.",
          ],
        },
        {
          title: "7. Security and incidents",
          paragraphs: [
            "Minerval uses access controls, encryption in transit, audit logs, backups, and incident monitoring. No system is infallible. If an incident affects personal data, Minerval assesses the risk, contains the incident, and notifies affected parties where required.",
          ],
        },
        {
          title: "8. Contact",
          paragraphs: [
            "Use the privacy address below for a personal-data question or request. Identity or authority verification may be required before disclosure or deletion.",
          ],
        },
      ],
    },
    terms: {
      title: "Terms of Use",
      description:
        "Rules applying to institutions, users, payers, and Minerval services.",
      updatedLabel: "Effective version",
      sections: [
        {
          title: "1. Acceptance and authority",
          paragraphs: [
            "By creating an account or using Minerval, you accept these terms. A person registering a school confirms that they are authorized to bind the institution and manage the relevant data and payments.",
          ],
        },
        {
          title: "2. Service",
          paragraphs: [
            "Minerval provides student management, school-fee collection, reconciliation, reporting, and payout tools. Mobile-money, banking, and subscription services are also subject to the rules and availability of their providers.",
          ],
        },
        {
          title: "3. Accounts and security",
          items: [
            "Provide accurate information, keep roles current, and protect login credentials.",
            "Promptly notify Minerval of suspected access, payment errors, or a change in authorized representative.",
            "Do not share student data beyond what is necessary and authorized.",
          ],
        },
        {
          title: "4. Prices and commissions",
          paragraphs: [
            "Before confirmation, the payment screen displays the school-fee amount, Minerval's 3% commission added for the payer, and the total charge. For a payout, Minerval's 3% commission is deducted from the amount requested by the school, and the net amount is shown before confirmation.",
            "Software subscriptions are displayed in US dollars: Growth at USD 29 per month and Pro at USD 99 per month, after any trial shown at signup. Taxes, exchange costs, or provider-specific fees may apply when disclosed by that provider. Any future price change must be displayed before it applies.",
          ],
        },
        {
          title: "5. Payments and payouts",
          paragraphs: [
            "An initiated or processing status does not prove final payment. Provider confirmation and settlement recording in Minerval determine confirmation. Payouts may be paused for security, compliance, balance, or identity checks.",
          ],
        },
        {
          title: "6. Prohibited use",
          items: [
            "Use the service for unlawful or fraudulent activity or without the institution's authority.",
            "Bypass security controls, falsify data, or disrupt the platform.",
            "Use student, parent, or user data outside authorized school administration.",
          ],
        },
        {
          title: "7. Availability and liability",
          paragraphs: [
            "Minerval aims to keep the service reliable, but interruptions may result from maintenance, telecom networks, mobile money, Internet access, or force majeure. To the extent permitted by law, Minerval is not responsible for delay or failure directly caused by an external provider or incorrect user-supplied information.",
          ],
        },
        {
          title: "8. Suspension and termination",
          paragraphs: [
            "An account may be suspended for fraud risk, security concerns, unpaid subscriptions, or a material breach of these terms. A school may request account closure, subject to resolving pending payments, payouts, and retention duties.",
          ],
        },
        {
          title: "9. Governing law and contact",
          paragraphs: [
            "These terms are governed by the law of the Democratic Republic of the Congo. The parties first seek an amicable resolution. The competent courts of the DRC remain available when no agreement is reached.",
          ],
        },
      ],
    },
    refunds: {
      title: "Cancellations, Refunds, and Disputes",
      description:
        "The process for Minerval subscriptions and school-fee payments.",
      updatedLabel: "Effective version",
      sections: [
        {
          title: "1. School subscriptions",
          paragraphs: [
            "A school may manage or cancel its subscription through the billing portal. Cancellation normally takes effect at the end of the paid period unless the portal says otherwise. Charges already invoiced are not automatically refundable.",
            "A reasoned request involving duplicate billing, a technical error, or significant unavailability may be reviewed case by case. Include the account email, invoice, and relevant date.",
          ],
        },
        {
          title: "2. Mobile-money school fees",
          paragraphs: [
            "Minerval facilitates payment on behalf of the school. The school remains responsible for deciding whether to refund school fees. The payer should contact the school shown on the receipt and provide the payment reference, phone number, amount, and reason.",
            "Do not immediately retry a payment shown as processing: wait for confirmation or failure to avoid a duplicate charge. For a duplicate charge or a debit with no confirmed receipt, contact the school and Minerval without sharing your PIN.",
          ],
        },
        {
          title: "3. Commission and timing",
          paragraphs: [
            "The commission displayed before payment covers service processing. Whether it can be refunded depends on the cause, transaction status, and fees already incurred with the provider. A request is accepted only after the transaction and the requester's identity or authority are verified.",
            "Actual timing depends on the school and mobile-money provider. Minerval cannot guarantee a specific banking or telecom timeframe but will share available tracking information.",
          ],
        },
        {
          title: "4. Disputes",
          paragraphs: [
            "To dispute a transaction, send its reference, date, amount, school, and the payer number's last four digits. Never send a PIN, password, or one-time code. A fraudulent dispute may lead to account or payment suspension.",
          ],
        },
      ],
    },
  },
};

export function getLegalDocument(locale: AppLocale, kind: LegalDocumentKind) {
  return LEGAL_COPY[locale][kind];
}
