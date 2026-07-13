export const EDUCATION_LEVELS = [
  "preschool",
  "primary",
  "secondary",
  "university",
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const DEFAULT_EDUCATION_LEVELS: EducationLevel[] = [
  "preschool",
  "primary",
  "secondary",
];

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  preschool: "Maternelle / préscolaire",
  primary: "Primaire",
  secondary: "Secondaire / humanités",
  university: "Supérieur / université",
};

const CLASS_SUGGESTIONS: Record<EducationLevel, string[]> = {
  preschool: [
    "1re Maternelle",
    "2e Maternelle",
    "3e Maternelle",
    "Classe pré-primaire",
  ],
  primary: [
    "1re Primaire",
    "2e Primaire",
    "3e Primaire",
    "4e Primaire",
    "5e Primaire",
    "6e Primaire",
  ],
  secondary: [
    "7e Éducation de base",
    "8e Éducation de base",
    "1re Humanités",
    "2e Humanités",
    "3e Humanités",
    "4e Humanités",
  ],
  university: [
    "Licence 1",
    "Licence 2",
    "Licence 3",
    "Master 1",
    "Master 2",
    "Doctorat",
  ],
};

export function getClassSuggestions(levels: readonly EducationLevel[]) {
  return levels.flatMap((level) => CLASS_SUGGESTIONS[level]);
}

export function isUniversityOnly(levels: readonly EducationLevel[]) {
  return levels.length === 1 && levels[0] === "university";
}
