/**
 * 파일 → base64 변환 유틸.
 * 백엔드 /generate-daily-record 는 순수 base64 (data URL prefix 없음)를 받는다.
 */

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('파일을 읽지 못했어요.'));
        return;
      }
      // "data:image/jpeg;base64,xxxx..." → "xxxx..."
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했어요.'));
    reader.readAsDataURL(file);
  });
}

/**
 * 큰 이미지를 리사이즈해서 data URL로 변환.
 * 큰 사진을 그대로 base64로 저장하면 localStorage 5MB 한도 및
 * API payload가 너무 커진다. 최대 변 1280px로 축소한다.
 */
export async function resizeToDataUrl(file: File, maxSide = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas context 실패');
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    bitmap.close?.();
  }
}

export function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}
