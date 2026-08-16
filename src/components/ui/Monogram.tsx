import { cn } from '@/lib/cn';

/**
 * Editorial identity tile: the first letter of a name, set in the display
 * face on a quiet tint. Replaces emoji avatars everywhere a course or school
 * needs a face — reads like a publisher's mark instead of a sticker.
 */
export default function Monogram({
  name,
  size = 'md',
  tint,
  ink,
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** Background color (e.g. the course theme's soft tone). Defaults to paper. */
  tint?: string;
  /** Letter color. Defaults to the ink text color. */
  ink?: string;
  className?: string;
}) {
  const sizes = {
    sm: 'w-8 h-8 text-sm rounded-lg',
    md: 'w-10 h-10 text-base rounded-xl',
    lg: 'w-12 h-12 text-lg rounded-xl',
  };
  const letter = (name.trim().charAt(0) || '·').toUpperCase();
  return (
    <span
      className={cn(
        'grid place-items-center font-display font-black select-none shrink-0',
        !tint && 'bg-paper border border-line',
        sizes[size],
        className,
      )}
      style={{ background: tint, color: ink }}
      aria-hidden
    >
      {letter}
    </span>
  );
}
