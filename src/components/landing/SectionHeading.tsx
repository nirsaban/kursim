import { cn } from '@/lib/cn';

/**
 * Shared opener for a landing section: title, an accent rule, then the
 * subtitle. Layouts pass their own type classes so the coralHota and classic
 * skins keep their distinct fonts while the rhythm stays identical.
 */
export default function SectionHeading({
  title,
  subtitle,
  accent,
  align = 'center',
  titleClassName,
  subtitleClassName,
  className,
}: {
  title: string;
  subtitle?: string;
  accent: string;
  align?: 'center' | 'start';
  titleClassName?: string;
  subtitleClassName?: string;
  className?: string;
}) {
  const centered = align === 'center';

  return (
    <div className={cn('mb-10', centered ? 'text-center' : 'text-start', className)}>
      <h2 className={cn('text-2xl sm:text-3xl', titleClassName)}>{title}</h2>

      {/* Accent rule — a hairline fading into a small diamond. */}
      <span
        className={cn('mt-3.5 flex items-center gap-2.5', centered ? 'justify-center' : 'justify-start')}
        aria-hidden
      >
        <span
          className="h-px w-10 rounded-full"
          style={{ background: accent, opacity: 0.35 }}
        />
        <span
          className="w-[7px] h-[7px] rotate-45 rounded-[2px]"
          style={{ background: accent }}
        />
        <span
          className="h-px w-10 rounded-full"
          style={{ background: accent, opacity: 0.35 }}
        />
      </span>

      {subtitle && (
        <p
          className={cn(
            'mt-4 text-[15px] sm:text-base leading-relaxed',
            centered && 'mx-auto max-w-xl',
            subtitleClassName,
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
