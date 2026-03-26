import { type Language } from "../i18n/messages.js";

/** A TTS provider generates speech audio and plays it to the audio device. */
export interface TtsProvider {
  readonly name: string;
  /** Speak the text to the configured audio device. */
  speak(text: string, lang: Language): Promise<void>;
}
