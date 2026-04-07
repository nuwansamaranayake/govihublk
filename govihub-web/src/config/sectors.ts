export interface SectorConfig {
  sector: string;
  name: string;
  tagline: string;
  cropTypes: string[] | null;
  description: string;
  primaryColor: string;
  accentColor: string;
  landingHero: {
    title_si: string;
    title_en: string;
    subtitle_si: string;
    subtitle_en: string;
  };
}

const SECTORS: Record<string, SectorConfig> = {
  spices: {
    sector: "spices",
    name: "GoviHub Spices",
    tagline: "Sri Lanka's AI Spice Marketplace",
    cropTypes: [
      "black_pepper",
      "turmeric",
      "ginger",
      "cloves",
      "nutmeg",
      "cardamom",
      "cinnamon",
      "mixed_spices",
    ],
    description: "Connect with verified spice buyers across Sri Lanka",
    primaryColor: "#2D6A2E",
    accentColor: "#E8A838",
    landingHero: {
      title_si: "ශ්‍රී ලංකාවේ AI කුළුබඩු වෙළඳපොළ",
      title_en: "Sri Lanka's AI Spice Marketplace",
      subtitle_si:
        "ගම්මිරිස්, කහ, ඉඟුරු, කරාබු නැටි, සාදික්කා, එනසාල්, කුරුඳු — ගොවීන් සහ ගැනුම්කරුවන් සෘජුව සම්බන්ධ කරන්න",
      subtitle_en:
        "Pepper, Turmeric, Ginger, Cloves, Nutmeg, Cardamom, Cinnamon — connecting farmers directly to buyers",
    },
  },
  beta: {
    sector: "beta",
    name: "GoviHub",
    tagline: "Sri Lanka's AI Farming Marketplace",
    cropTypes: null,
    description: "AI-powered smart farming marketplace",
    primaryColor: "#2D6A2E",
    accentColor: "#E8A838",
    landingHero: {
      title_si: "ශ්‍රී ලංකාවේ AI ගොවිපල වෙළඳපොළ",
      title_en: "Sri Lanka's AI Farming Marketplace",
      subtitle_si: "ගොවීන් සහ ගැනුම්කරුවන් සෘජුව සම්බන්ධ කරන්න",
      subtitle_en: "Connecting farmers directly to buyers",
    },
  },
};

export function getSectorFromHostname(hostname: string): string {
  if (hostname.includes("spices")) return "spices";
  return "beta";
}

export function getSectorConfig(hostname: string): SectorConfig {
  const sector = getSectorFromHostname(hostname);
  return SECTORS[sector] || SECTORS.beta;
}
