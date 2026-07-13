import { describe, expect, it } from "vitest";
import {
  getClassSuggestions,
  isUniversityOnly,
} from "@/lib/congo-education";

describe("Congolese education levels", () => {
  it("uses the official basic-education and humanities progression", () => {
    expect(getClassSuggestions(["primary", "secondary"])).toEqual([
      "1re Primaire",
      "2e Primaire",
      "3e Primaire",
      "4e Primaire",
      "5e Primaire",
      "6e Primaire",
      "7e Éducation de base",
      "8e Éducation de base",
      "1re Humanités",
      "2e Humanités",
      "3e Humanités",
      "4e Humanités",
    ]);
  });

  it("provides the university LMD progression", () => {
    expect(getClassSuggestions(["university"])).toEqual([
      "Licence 1",
      "Licence 2",
      "Licence 3",
      "Master 1",
      "Master 2",
      "Doctorat",
    ]);
    expect(isUniversityOnly(["university"])).toBe(true);
  });
});
