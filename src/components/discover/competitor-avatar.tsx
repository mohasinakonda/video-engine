import Image from 'next/image';
import { Youtube } from 'lucide-react';

export function CompetitorAvatar({ src, size = 44 }: { src: string | null | undefined; size?: number }) {
  return src ? (
    <Image src={src} alt="" width={size} height={size} className="rounded-full border border-bg-border object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-bg-elevated border border-bg-border flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <Youtube size={size / 2.4} className="text-zinc-500" />
    </div>
  );
}
