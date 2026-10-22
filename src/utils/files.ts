export const MAX_LOGO_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_LOGO_BYTES = 150 * 1024;
export const MAX_LOGO_DATA_URL_BYTES = 900 * 1024;
export const MAX_LOGO_DIMENSION = 256;
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export function validateImageFile(file: File): string | null {
  if (file.size === 0) return 'O arquivo selecionado está vazio.';
  if (file.size > MAX_LOGO_SOURCE_BYTES) return 'A imagem original deve ter no máximo 10 MB.';
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return 'Use uma imagem PNG, JPG ou WebP.';
  }
  return null;
}

export function detectImageMimeType(bytes: Uint8Array): (typeof ALLOWED_IMAGE_TYPES)[number] | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem processada.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('O navegador não conseguiu preparar a imagem.'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

function readImageHeader(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('O navegador não conseguiu verificar o arquivo selecionado.'));
        return;
      }
      resolve(new Uint8Array(reader.result));
    };
    reader.readAsArrayBuffer(file.slice(0, 12));
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob?.type === 'image/jpeg') resolve(blob);
        else reject(new Error('O navegador não conseguiu comprimir a imagem.'));
      },
      'image/jpeg',
      quality,
    );
  });
}

/** Redimensiona e comprime localmente; somente a Data URL resultante é persistida no Firestore. */
export async function compressLogoImage(file: File): Promise<string> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);

  const header = await readImageHeader(file);
  const actualType = detectImageMimeType(header);
  if (!actualType || (file.type && file.type !== actualType)) {
    throw new Error('O conteúdo do arquivo não corresponde a uma imagem PNG, JPG ou WebP válida.');
  }
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Este navegador não oferece suporte ao processamento local de imagens.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Não foi possível decodificar a imagem. Escolha outro arquivo PNG, JPG ou WebP.');
  }

  try {
    const scale = Math.min(1, MAX_LOGO_DIMENSION / bitmap.width, MAX_LOGO_DIMENSION / bitmap.height);
    const baseWidth = Math.max(1, Math.round(bitmap.width * scale));
    const baseHeight = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não conseguiu iniciar o processamento da imagem.');

    const dimensionScales = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
    const qualities = [0.86, 0.74, 0.62, 0.5, 0.38];
    for (const dimensionScale of dimensionScales) {
      canvas.width = Math.max(1, Math.round(baseWidth * dimensionScale));
      canvas.height = Math.max(1, Math.round(baseHeight * dimensionScale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of qualities) {
        const compressed = await canvasToJpeg(canvas, quality);
        if (compressed.size <= MAX_LOGO_BYTES) return await readAsDataUrl(compressed);
      }
    }
  } finally {
    bitmap.close();
  }

  throw new Error('Não foi possível reduzir a imagem para 150 KB. Escolha uma imagem mais simples.');
}

/** Valida logos já comprimidos e o tamanho conservador do documento antes da gravação. */
export function assertLogoDataUrl(value: string): void {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match) throw new Error('A imagem preparada não está em um formato JPEG válido.');
  const payload = match[1];
  if (payload.length === 0 || payload.length % 4 !== 0) {
    throw new Error('A imagem preparada está incompleta. Selecione o arquivo novamente.');
  }
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  const decodedBytes = Math.floor((payload.length * 3) / 4) - padding;
  if (decodedBytes > MAX_LOGO_BYTES) {
    throw new Error('A imagem comprimida excede o limite de 150 KB. Selecione outra imagem.');
  }
}

export function assertFirestoreDocumentSize(document: Record<string, unknown>): void {
  const serialized = JSON.stringify(document);
  const estimatedBytes = new TextEncoder().encode(serialized).byteLength + 4096;
  if (estimatedBytes > MAX_LOGO_DATA_URL_BYTES) {
    throw new Error('Os dados deste cadastro ficariam grandes demais para o Firestore. Reduza a imagem ou revise os dados do cadastro.');
  }
}
