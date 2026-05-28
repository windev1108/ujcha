import { api } from "@/config/server";

export interface PosRelease {
  id: string;
  version: string;
  downloadUrl: string;
  releaseNotes: string;
  updatedAt: string;
}

export async function fetchPosRelease(): Promise<PosRelease> {
  const { data } = await api.get<PosRelease>("/kun-pos/version");
  return data;
}

export async function updatePosRelease(body: {
  version: string;
  downloadUrl: string;
  releaseNotes?: string;
}): Promise<PosRelease> {
  const { data } = await api.put<PosRelease>("/kun-pos/version", body);
  return data;
}
