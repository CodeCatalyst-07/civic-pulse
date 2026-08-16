export const supportedLanguages = [
  { code: "en", label: "English", speechCode: "en-IN" },
  { code: "hi", label: "हिन्दी (Hindi)", speechCode: "hi-IN" },
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number]["code"];
export type CitizenChannel = "text" | "voice";
export type CitizenLocation = { latitude: number; longitude: number } | null;

export interface CitizenReportPayload {
  countryCode: "IN";
  channel: CitizenChannel;
  language: SupportedLanguage;
  text: string;
  location?: { latitude: number; longitude: number };
  selectedRegionId?: string;
}

export function createReportPayload(input: { text: string; language: SupportedLanguage; channel: CitizenChannel; location: CitizenLocation; selectedRegionId: string }): CitizenReportPayload {
  const text = input.text.trim();
  if (!text) throw new Error("Describe the issue before submitting.");
  return {
    countryCode: "IN",
    channel: input.channel,
    language: input.language,
    text,
    ...(input.location ? { location: input.location } : {}),
    ...(input.selectedRegionId ? { selectedRegionId: input.selectedRegionId } : {}),
  };
}

export function microphoneFailureMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone permission was denied. Allow microphone access and try again.";
  if (name === "NotFoundError") return "No microphone was found on this device.";
  return "Voice input could not start. Check your microphone and try again.";
}

export async function submitCitizenReport(fetcher: typeof fetch, apiBase: string, payload: CitizenReportPayload): Promise<{ reportId: string; category: string }> {
  const response = await fetcher(`${apiBase}/api/reports`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json() as { reportId?: string; structuredRequest?: { category?: string }; error?: string };
  if (!response.ok || !body.reportId || !body.structuredRequest?.category) throw new Error(body.error ?? "Your request could not be submitted. Please try again.");
  return { reportId: body.reportId, category: body.structuredRequest.category };
}
