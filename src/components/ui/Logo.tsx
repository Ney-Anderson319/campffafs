import { useEffect, useState } from 'react';
import { initials } from '../../utils/format';

export function Logo({ url, name, size = 48 }: { url?: string | null; name: string; size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  useEffect(() => setFailedUrl(null), [url]);
  const style = { width: size, height: size, fontSize: Math.max(12, size * 0.36) };
  if (url && failedUrl !== url) {
    return <img className="logo" src={url} alt={`Logo de ${name}`} style={style} loading="lazy" onError={() => setFailedUrl(url)} />;
  }
  return (
    <span className="logo logo-placeholder" style={style} aria-hidden>
      {initials(name)}
    </span>
  );
}
