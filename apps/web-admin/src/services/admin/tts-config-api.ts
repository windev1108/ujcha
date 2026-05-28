import { api } from '@/config/server';

export interface TtsConfig {
  voice: string;
  speed: number;
  tts_return_option: number;
  without_filter: boolean;
}

export async function fetchTtsConfig(): Promise<TtsConfig> {
  const { data } = await api.get<TtsConfig>('/admin/shop-settings/tts-config');
  return data;
}

export async function updateTtsConfig(body: Partial<TtsConfig>): Promise<TtsConfig> {
  const { data } = await api.patch<TtsConfig>('/admin/shop-settings/tts-config', body);
  return data;
}
