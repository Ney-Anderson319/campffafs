import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertFirestoreDocumentSize,
  assertLogoDataUrl,
  compressLogoImage,
  detectImageMimeType,
  MAX_LOGO_BYTES,
  MAX_LOGO_DATA_URL_BYTES,
  MAX_LOGO_DIMENSION,
  validateImageFile,
} from './files';

afterEach(() => vi.restoreAllMocks());

describe('validação e compressão de logos', () => {
  it('aceita somente imagens dentro do limite original e identifica o conteúdo real', () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateImageFile(new File([pngHeader], 'logo.png', { type: 'image/png' }))).toBeNull();
    expect(detectImageMimeType(pngHeader)).toBe('image/png');
    expect(detectImageMimeType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('image/jpeg');
    expect(detectImageMimeType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp');
    expect(detectImageMimeType(new Uint8Array([0, 1, 2, 3]))).toBeNull();
    expect(validateImageFile(new File(['x'], 'logo.gif', { type: 'image/gif' }))).toMatch(/PNG, JPG ou WebP/);
  });

  it('rejeita arquivo original vazio ou acima de 10 MB', () => {
    expect(validateImageFile(new File([], 'empty.png', { type: 'image/png' }))).toMatch(/vazio/);
    expect(validateImageFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).toMatch(/10 MB/);
  });

  it('rejeita extensão MIME válida com conteúdo não correspondente', async () => {
    const file = new File(['não é PNG'], 'logo.png', { type: 'image/png' });
    await expect(compressLogoImage(file)).rejects.toThrow(/conteúdo do arquivo/);
  });

  it('redimensiona proporcionalmente e retorna JPEG comprimido em Data URL', async () => {
    const bitmap = { width: 1024, height: 512, close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    const drawImage = vi.fn();
    const context = { fillRect: vi.fn(), drawImage, fillStyle: '' } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob([new Uint8Array(1024)], { type: 'image/jpeg' }));
    });
    const file = new File([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], 'logo.png', { type: 'image/png' });

    const dataUrl = await compressLogoImage(file);
    expect(dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 256, 128);
    expect(bitmap.close).toHaveBeenCalledOnce();
    assertLogoDataUrl(dataUrl);
    expect(MAX_LOGO_BYTES).toBe(150 * 1024);
    expect(MAX_LOGO_DIMENSION).toBe(256);
  });
});

describe('validação do documento Firestore', () => {
  it('aceita uma logo Data URL JPEG válida', () => {
    expect(() => assertLogoDataUrl('data:image/jpeg;base64,AAAA')).not.toThrow();
  });

  it('rejeita Data URL inválida ou maior que 150 KB', () => {
    expect(() => assertLogoDataUrl('data:image/png;base64,AAAA')).toThrow(/JPEG válido/);
    const oversizedBase64 = 'A'.repeat(Math.ceil((MAX_LOGO_BYTES + 1) * 4 / 3 / 4) * 4);
    expect(() => assertLogoDataUrl(`data:image/jpeg;base64,${oversizedBase64}`)).toThrow(/150 KB/);
  });

  it('recusa documentos acima da margem conservadora de 900 KiB', () => {
    expect(() => assertFirestoreDocumentSize({ name: 'Equipe', logoUrl: null })).not.toThrow();
    expect(() => assertFirestoreDocumentSize({ customData: 'x'.repeat(MAX_LOGO_DATA_URL_BYTES) })).toThrow(/grandes demais/);
  });
});
