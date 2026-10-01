import { Avatar as PaperAvatar } from 'react-native-paper';

const PALETTE = ['#0B8A6F', '#3A6B8C', '#8C5A3A', '#6B3A8C', '#8C3A55', '#3A8C4A', '#8C7A3A', '#3A5A8C'];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic colored initials avatar (color derived from node/group id). */
export function Avatar({ id, label, size = 44, icon }: { id: string; label: string; size?: number; icon?: string }) {
  const color = PALETTE[hash(id) % PALETTE.length];
  if (icon) return <PaperAvatar.Icon size={size} icon={icon} style={{ backgroundColor: color }} color="#fff" />;
  const initials =
    label
      .replace(/^#/, '')
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';
  return <PaperAvatar.Text size={size} label={initials} style={{ backgroundColor: color }} color="#fff" />;
}
