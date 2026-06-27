import { isTimberLakeCamp } from "@/lib/camps";

export const DEFAULT_TUTORING_THERAPY_SERVICE_TYPES = [
  "Math Tutoring",
  "Reading Tutoring",
  "Science Tutoring",
  "Speech Therapy",
  "Occupational Therapy",
  "Physical Therapy",
  "Behavioral Therapy",
  "Music Therapy",
  "Art Therapy",
  "ESL Tutoring",
] as const;

export const TIMBER_LAKE_TUTORING_THERAPY_SERVICE_TYPES = [
  "Therapy",
  "Tutoring",
  "Other",
] as const;

export function getTutoringTherapyServiceTypes(
  companySlug: string | null | undefined,
): string[] {
  if (isTimberLakeCamp(companySlug)) {
    return [...TIMBER_LAKE_TUTORING_THERAPY_SERVICE_TYPES];
  }
  return [...DEFAULT_TUTORING_THERAPY_SERVICE_TYPES];
}

export const tutoringTherapyServiceColors: Record<string, string> = {
  Therapy: "bg-pink-100 text-pink-800 border-pink-200",
  Tutoring: "bg-blue-100 text-blue-800 border-blue-200",
  Other: "bg-gray-100 text-gray-800 border-gray-200",
  "Math Tutoring": "bg-blue-100 text-blue-800 border-blue-200",
  "Reading Tutoring": "bg-purple-100 text-purple-800 border-purple-200",
  "Science Tutoring": "bg-green-100 text-green-800 border-green-200",
  "Speech Therapy": "bg-pink-100 text-pink-800 border-pink-200",
  "Occupational Therapy": "bg-orange-100 text-orange-800 border-orange-200",
  "Physical Therapy": "bg-teal-100 text-teal-800 border-teal-200",
  "Behavioral Therapy": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Music Therapy": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Art Therapy": "bg-red-100 text-red-800 border-red-200",
  "ESL Tutoring": "bg-cyan-100 text-cyan-800 border-cyan-200",
};

export function getTutoringTherapyServiceColor(serviceType: string): string {
  return tutoringTherapyServiceColors[serviceType] || "bg-gray-100 text-gray-800";
}
