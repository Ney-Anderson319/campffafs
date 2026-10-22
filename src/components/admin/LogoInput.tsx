import { useState } from 'react';
import { Logo } from '../ui/Logo';
import { compressLogoImage, validateImageFile } from '../../utils/files';

interface Props {
  name: string;
  currentUrl: string | null;
  image: string | null;
  remove: boolean;
  onChange: (image: string | null, remove: boolean) => void;
  onError: (msg: string | null) => void;
  onProcessingChange: (processing: boolean) => void;
}

export function LogoInput({ name, currentUrl, image, remove, onChange, onError, onProcessingChange }: Props) {
  const [processing, setProcessing] = useState(false);
  const shown = image ?? (remove ? null : currentUrl);
  const selectImage = async (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      onError(problem);
      onChange(image, false);
      input.value = '';
      return;
    }
    setProcessing(true);
    onProcessingChange(true);
    try {
      onChange(await compressLogoImage(file), false);
      onError(null);
    } catch (error) {
      onChange(image, false);
      onError(error instanceof Error ? error.message : 'Não foi possível processar a imagem.');
      input.value = '';
    } finally {
      setProcessing(false);
      onProcessingChange(false);
    }
  };
  return (
    <div className="field">
      <span>Logo (opcional)</span>
      <div className="logo-input">
        <Logo url={shown} name={name || '?'} size={64} />
        <div className="stack">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Selecionar logo"
            disabled={processing}
            onChange={(e) => void selectImage(e.target.files?.[0], e.currentTarget)}
          />
          <small className="muted">{processing ? 'Redimensionando e comprimindo imagem…' : 'PNG, JPG ou WebP, arquivo original até 10 MB; imagem salva até 150 KB e 256 × 256 px.'}</small>
          {(currentUrl || image) && !remove && (
            <button type="button" className="link-btn" disabled={processing} onClick={() => { onChange(null, true); onError(null); }}>
              Remover logo
            </button>
          )}
          {remove && <small className="muted">O logo será removido ao salvar.</small>}
        </div>
      </div>
    </div>
  );
}
