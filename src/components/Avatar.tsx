import { Avatar as PaperAvatar } from 'react-native-paper';

// Primary blue plus muted shades of the same cool family (DESIGN.md → Avatar).
const PALETTE = ['#0052A5', '#1B66B5', '#2E5E8C', '#34708F', '#4A5FA8', '#27648F', '#55689A', '#16508A'];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic colored initials avatar (color derived from the node / conversation id). */
export function Avatar({ id, label, size = 40, icon }: { id: string; label: string; size?: number; icon?: string }) {
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
