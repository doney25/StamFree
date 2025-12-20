import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export type UploadResult = {
  ok: boolean;
  status: number;
  json?: any;
  error?: string;
};

export function getMimeFromUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'm4a':
      return 'audio/m4a';
    case 'aac':
      return 'audio/aac';
    case 'caf':
      return 'audio/x-caf';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case '3gp':
      return 'audio/3gpp';
    default:
      // Reasonable defaults per platform
      return Platform.OS === 'ios' ? 'audio/m4a' : 'audio/3gpp';
  }
}

export function createFormData(uri: string): FormData {
  const type = getMimeFromUri(uri);
  const name = `recording.${type.split('/')[1] ?? 'm4a'}`;
  const file: any = { uri, name, type };
  const form = new FormData();
  form.append('file', file as any);
  return form;
}

export async function uploadAudioWithTimeout(url: string, formData: FormData, timeoutMs = 6000): Promise<UploadResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    let data: any = null;
    try {
      data = await res.json();
    } catch (_) {
      // Non-JSON response
    }

    if (!res.ok || !data) {
      return { ok: false, status: res.status, json: data, error: 'Invalid server response' };
    }
    return { ok: true, status: res.status, json: data };
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Request timed out' : (e?.message ?? 'Network error');
    return { ok: false, status: 0, error: msg };
  }
}

export async function deleteLocalFile(uri?: string | null): Promise<void> {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Ignore deletion errors
  }
}
