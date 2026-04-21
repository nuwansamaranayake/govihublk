"use client";

import { useMemo } from "react";
import { getSectorFromHostname } from "@/config/sectors";

/** Sector-aware crop lists, suggested questions, and example text */

export const SPICE_CROPS = [
  "Black Pepper", "Cinnamon", "Clove", "Nutmeg",
  "Cardamom", "Turmeric", "Ginger", "Vanilla",
];

export const GENERAL_CROPS = [
  "Tomato", "Cabbage", "Carrot", "Beans", "Potato", "Onion",
  "Chilli", "Brinjal", "Cucumber", "Pumpkin", "Leek", "Radish",
  "Lettuce", "Spinach", "Peas", "Corn", "Ginger", "Garlic",
];

export const SPICE_DIAGNOSIS_OPTIONS = [
  { value: "", labelKey: "selectCrop" },
  { value: "Black Pepper", labelKey: "cropBlackPepper" },
  { value: "Cinnamon", labelKey: "cropCinnamon" },
  { value: "Clove", labelKey: "cropClove" },
  { value: "Nutmeg", labelKey: "cropNutmeg" },
  { value: "Cardamom", labelKey: "cropCardamom" },
  { value: "Turmeric", labelKey: "cropTurmeric" },
  { value: "Ginger", labelKey: "cropGinger" },
  { value: "Vanilla", labelKey: "cropVanilla" },
  { value: "Other", labelKey: "cropOther" },
];

export const GENERAL_DIAGNOSIS_OPTIONS = [
  { value: "", labelKey: "selectCrop" },
  { value: "Rice", labelKey: "cropRice" },
  { value: "Tomato", labelKey: "cropTomato" },
  { value: "Chili", labelKey: "cropChili" },
  { value: "Onion", labelKey: "cropOnion" },
  { value: "Beans", labelKey: "cropBeans" },
  { value: "Brinjal", labelKey: "cropBrinjal" },
  { value: "Other", labelKey: "cropOther" },
];

export const SPICE_SUGGESTED_EN = [
  "How do I prevent black pepper wilt disease?",
  "What fertilizer is best for turmeric?",
  "When should I harvest cinnamon bark?",
  "How to deal with pepper berry borer naturally?",
  "Best irrigation method for ginger in dry season?",
];

export const GENERAL_SUGGESTED_EN = [
  "How do I prevent tomato blight?",
  "What fertilizer is best for cabbage?",
  "When should I harvest carrots?",
  "How to deal with aphids naturally?",
  "Best irrigation method for dry season?",
];

export const SPICE_SUGGESTED_SI = [
  "ගම්මිරිස් මැලවීම වළක්වන්නේ කෙසේද?",
  "කහ සඳහා හොඳම පොහොර කුමක්ද?",
  "කුරුඳු පොතු නෙළිය යුත්තේ කවදාද?",
];

export const GENERAL_SUGGESTED_SI = [
  "තක්කාලි රෝග වළක්වන්නේ කෙසේද?",
  "ගෝවා සඳහා හොඳම පොහොර කුමක්ද?",
  "කැරට් අස්වනු නෙළිය යුත්තේ කවදාද?",
];


/**
 * Client-side hook that returns the current sector based on hostname.
 * Use this in any component that needs sector-aware content.
 */
export function useSector() {
  const sector = useMemo(() => {
    if (typeof window === "undefined") return "beta";
    return getSectorFromHostname(window.location.hostname);
  }, []);

  const isSpices = sector === "spices";

  return {
    sector,
    isSpices,
    crops: isSpices ? SPICE_CROPS : GENERAL_CROPS,
    diagnosisOptions: isSpices ? SPICE_DIAGNOSIS_OPTIONS : GENERAL_DIAGNOSIS_OPTIONS,
    suggestedQuestionsEn: isSpices ? SPICE_SUGGESTED_EN : GENERAL_SUGGESTED_EN,
    suggestedQuestionsSi: isSpices ? SPICE_SUGGESTED_SI : GENERAL_SUGGESTED_SI,
    varietyPlaceholder: isSpices ? "e.g. Lanka Organic" : "e.g. Big Beef",
    cropPlaceholder: isSpices ? "e.g. Black Pepper" : "e.g. Tomato",
    cropPlaceholderSi: isSpices ? "e.g. ගම්මිරිස්" : "e.g. තක්කාලි",
    cropPlaceholderTa: isSpices ? "e.g. மிளகு" : "e.g. தக்காளி",
    knowledgePlaceholder: isSpices ? "e.g. Black Pepper Cultivation Guide" : "e.g. Tomato Cultivation Guide",
    defaultCropCategory: isSpices ? "spice" as const : "vegetable" as const,
    helpTipExample: isSpices
      ? "my pepper leaves have yellow spots and are drooping"
      : "my paddy leaves have brown spots and are curling",
  };
}

export default useSector;
