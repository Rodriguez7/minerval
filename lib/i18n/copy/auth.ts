import type { AppLocale } from "../config";

type AuthCopy = {
  actions: {
    invalidCredentialsFormat: string;
    invalidCredentials: string;
    validEmail: string;
    resetEmailFailed: string;
    signupValidation: string;
    signupFailed: string;
    passwordMin: string;
  };
  login: {
    heroEyebrow: string;
    heroTitleLines: [string, string, string];
    heroDescription: string;
    stats: [
      { label: string; sub: string },
      { label: string; sub: string },
      { label: string; sub: string }
    ];
    heading: string;
    subheading: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    forgotPassword: string;
    submit: string;
    footerPrompt: string;
    footerLink: string;
  };
  signup: {
    heading: string;
    subheading: string;
    emailLabel: string;
    passwordLabel: string;
    passwordHint: string;
    submitPending: string;
    submit: string;
    footerPrompt: string;
    footerLink: string;
  };
  forgotPassword: {
    heroEyebrow: string;
    heroTitleLines: [string, string];
    heroDescription: string;
    securityCards: [
      { title: string; desc: string },
      { title: string; desc: string }
    ];
    successTitle: string;
    successDescription: string;
    backToSignIn: string;
    retry: string;
    successFooterPrompt: string;
    heading: string;
    subheading: string;
    emailLabel: string;
    emailPlaceholder: string;
    submit: string;
    footerPrompt: string;
    footerLink: string;
  };
  resetPassword: {
    heroEyebrow: string;
    heroTitleLines: [string, string];
    heroDescription: string;
    stepsLabel: string;
    steps: [string, string, string];
    successTitle: string;
    successDescription: string;
    heading: string;
    subheading: string;
    newPasswordLabel: string;
    newPasswordPlaceholder: string;
    confirmPasswordLabel: string;
    confirmPasswordPlaceholder: string;
    strengthLabels: [string, string, string, string];
    matchYes: string;
    matchNo: string;
    submit: string;
    footerPrompt: string;
    footerLink: string;
    errors: {
      passwordMin: string;
      passwordMismatch: string;
    };
  };
};

export const AUTH_COPY: Record<AppLocale, AuthCopy> = {
  fr: {
    actions: {
      invalidCredentialsFormat:
        "Le format de l'email ou du mot de passe est invalide.",
      invalidCredentials: "Email ou mot de passe invalide.",
      validEmail: "Veuillez saisir une adresse email valide.",
      resetEmailFailed:
        "Impossible d'envoyer l'email de reinitialisation. Reessayez.",
      signupValidation: "Verifiez les informations saisies.",
      signupFailed: "Impossible de creer le compte.",
      passwordMin:
        "Le mot de passe doit contenir au moins 8 caracteres.",
    },
    login: {
      heroEyebrow: "Finances scolaires simplifiees",
      heroTitleLines: [
        "Chaque paiement.",
        "Chaque eleve.",
        "Un seul tableau de bord.",
      ],
      heroDescription:
        "Collectez les frais scolaires par mobile money et rapprochez les paiements en temps reel, sans feuilles Excel ni caisse manuelle.",
      stats: [
        { label: "Collecte aujourd'hui", sub: "+12 % vs hier" },
        { label: "Eleves payes", sub: "sur 312" },
        { label: "En attente", sub: "< 1 h" },
      ],
      heading: "Bon retour",
      subheading: "Connectez-vous au tableau de bord de votre ecole",
      emailLabel: "Adresse email",
      emailPlaceholder: "admin@votre-ecole.org",
      passwordLabel: "Mot de passe",
      passwordPlaceholder: "••••••••",
      forgotPassword: "Mot de passe oublie ?",
      submit: "Se connecter",
      footerPrompt: "Nouvelle ecole ?",
      footerLink: "Creer un compte gratuit",
    },
    signup: {
      heading: "Creez votre compte",
      subheading: "Vous configurerez votre ecole a l'etape suivante.",
      emailLabel: "Email",
      passwordLabel: "Mot de passe",
      passwordHint: "8 caracteres minimum",
      submitPending: "Creation du compte…",
      submit: "Creer le compte",
      footerPrompt: "Vous avez deja un compte ?",
      footerLink: "Se connecter",
    },
    forgotPassword: {
      heroEyebrow: "Recuperation du compte",
      heroTitleLines: ["Retour en ligne", "en deux minutes."],
      heroDescription:
        "Entrez votre email et nous enverrons un lien de reinitialisation securise directement dans votre boite de reception.",
      securityCards: [
        {
          title: "Lien chiffre",
          desc: "Votre lien de reinitialisation est a usage unique et expire dans 1 heure.",
        },
        {
          title: "Aucun mot de passe expose",
          desc: "Nous n'envoyons jamais votre mot de passe actuel par email.",
        },
      ],
      successTitle: "Consultez votre boite mail",
      successDescription:
        "Un lien de reinitialisation est en route. Il expire dans 1 heure. Verifiez aussi vos spams si besoin.",
      backToSignIn: "Retour a la connexion",
      retry: "Reessayer",
      successFooterPrompt: "Vous ne l'avez pas recu ?",
      heading: "Mot de passe oublie ?",
      subheading:
        "Aucun probleme. Saisissez votre email et nous vous enverrons un lien.",
      emailLabel: "Adresse email",
      emailPlaceholder: "admin@votre-ecole.org",
      submit: "Envoyer le lien",
      footerPrompt: "Vous vous souvenez de votre mot de passe ?",
      footerLink: "Se connecter",
    },
    resetPassword: {
      heroEyebrow: "Presque termine",
      heroTitleLines: ["Choisissez un mot de passe", "facile a retenir."],
      heroDescription:
        "Votre nouveau mot de passe remplacera l'ancien immediatement.",
      stepsLabel: "Et ensuite",
      steps: [
        "Definissez votre nouveau mot de passe ci-dessous",
        "Vous serez reconnecte automatiquement",
        "Continuez dans votre tableau de bord",
      ],
      successTitle: "Mot de passe mis a jour",
      successDescription: "Redirection vers votre tableau de bord…",
      heading: "Definir un nouveau mot de passe",
      subheading:
        "Choisissez quelque chose de solide, avec au moins 8 caracteres.",
      newPasswordLabel: "Nouveau mot de passe",
      newPasswordPlaceholder: "Min. 8 caracteres",
      confirmPasswordLabel: "Confirmer le mot de passe",
      confirmPasswordPlaceholder: "Repetez votre mot de passe",
      strengthLabels: ["", "Trop court", "Correct", "Fort"],
      matchYes: "Les mots de passe correspondent",
      matchNo: "Les mots de passe ne correspondent pas",
      submit: "Mettre a jour le mot de passe",
      footerPrompt: "Vous vous souvenez de votre mot de passe ?",
      footerLink: "Se connecter",
      errors: {
        passwordMin:
          "Le mot de passe doit contenir au moins 8 caracteres.",
        passwordMismatch: "Les mots de passe ne correspondent pas.",
      },
    },
  },
  en: {
    actions: {
      invalidCredentialsFormat: "Invalid email or password format.",
      invalidCredentials: "Invalid email or password.",
      validEmail: "Please enter a valid email address.",
      resetEmailFailed: "Failed to send reset email. Please try again.",
      signupValidation: "Check the information you entered.",
      signupFailed: "Signup failed.",
      passwordMin: "Password must be at least 8 characters.",
    },
    login: {
      heroEyebrow: "School finance, simplified",
      heroTitleLines: [
        "Every payment.",
        "Every student.",
        "One dashboard.",
      ],
      heroDescription:
        "Collect school fees via mobile money and reconcile in real time, with no spreadsheets and no cash counting.",
      stats: [
        { label: "Collected today", sub: "+12% vs yesterday" },
        { label: "Students paid", sub: "of 312" },
        { label: "Pending", sub: "< 1h old" },
      ],
      heading: "Welcome back",
      subheading: "Sign in to your school dashboard",
      emailLabel: "Email address",
      emailPlaceholder: "admin@yourschool.org",
      passwordLabel: "Password",
      passwordPlaceholder: "••••••••",
      forgotPassword: "Forgot password?",
      submit: "Sign in",
      footerPrompt: "New school?",
      footerLink: "Create a free account",
    },
    signup: {
      heading: "Create your account",
      subheading: "You'll set up your school on the next screen.",
      emailLabel: "Email",
      passwordLabel: "Password",
      passwordHint: "8 characters minimum",
      submitPending: "Creating account…",
      submit: "Create account",
      footerPrompt: "Already have an account?",
      footerLink: "Sign in",
    },
    forgotPassword: {
      heroEyebrow: "Account recovery",
      heroTitleLines: ["Back online", "in two minutes."],
      heroDescription:
        "Enter your email and we'll send a secure reset link straight to your inbox.",
      securityCards: [
        {
          title: "Encrypted link",
          desc: "Your reset link is single-use and expires in 1 hour.",
        },
        {
          title: "No password exposure",
          desc: "We never send your current password by email.",
        },
      ],
      successTitle: "Check your inbox",
      successDescription:
        "A password reset link is on its way. It expires in 1 hour. Check spam if needed.",
      backToSignIn: "Back to sign in",
      retry: "Try again",
      successFooterPrompt: "Didn't receive it?",
      heading: "Forgot your password?",
      subheading: "No problem. Enter your email and we'll send a reset link.",
      emailLabel: "Email address",
      emailPlaceholder: "admin@yourschool.org",
      submit: "Send reset link",
      footerPrompt: "Remember your password?",
      footerLink: "Sign in",
    },
    resetPassword: {
      heroEyebrow: "Almost done",
      heroTitleLines: ["Choose a password", "you'll remember."],
      heroDescription:
        "Your new password will replace the old one immediately.",
      stepsLabel: "What happens next",
      steps: [
        "Set your new password below",
        "You'll be signed in automatically",
        "Manage your account from the dashboard",
      ],
      successTitle: "Password updated",
      successDescription: "Taking you to your dashboard…",
      heading: "Set new password",
      subheading: "Choose something strong, at least 8 characters.",
      newPasswordLabel: "New password",
      newPasswordPlaceholder: "Min. 8 characters",
      confirmPasswordLabel: "Confirm password",
      confirmPasswordPlaceholder: "Repeat your password",
      strengthLabels: ["", "Too short", "Good", "Strong"],
      matchYes: "Passwords match",
      matchNo: "Does not match",
      submit: "Update password",
      footerPrompt: "Remembered your password?",
      footerLink: "Sign in",
      errors: {
        passwordMin: "Password must be at least 8 characters.",
        passwordMismatch: "Passwords do not match.",
      },
    },
  },
};

export function getAuthCopy(locale: AppLocale) {
  return AUTH_COPY[locale];
}
