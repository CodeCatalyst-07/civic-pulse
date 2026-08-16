import { SpeechClient } from "@google-cloud/speech";

export interface SpeechTranscriptionInput {
  audioBase64: string;
  languageCode: string;
  mimeType: "audio/webm" | "audio/ogg";
}

export interface SpeechTranscriptionService {
  transcribe(input: SpeechTranscriptionInput): Promise<string>;
}

export class GoogleSpeechTranscriptionService implements SpeechTranscriptionService {
  private readonly client = new SpeechClient();

  async transcribe({ audioBase64, languageCode, mimeType }: SpeechTranscriptionInput): Promise<string> {
    const [response] = await this.client.recognize({
      audio: { content: audioBase64 },
      config: {
        encoding: mimeType === "audio/ogg" ? "OGG_OPUS" : "WEBM_OPUS",
        languageCode,
        enableAutomaticPunctuation: true,
      },
    });
    return (response.results ?? []).map((result) => result.alternatives?.[0]?.transcript?.trim() ?? "").filter(Boolean).join(" ");
  }
}
