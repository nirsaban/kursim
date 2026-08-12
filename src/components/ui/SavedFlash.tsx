import { cn } from '@/lib/cn';
import { he } from '@/lib/he';

/** Small transient "✓ saved" flash next to whatever field just autosaved. */
export default function SavedFlash({ shown }: { shown: boolean }) {
  return (
    <span
      className={cn(
        'text-xs font-medium text-ok transition-opacity duration-300',
        shown ? 'opacity-100' : 'opacity-0',
      )}
      aria-hidden={!shown}
    >
      {he.saved}
    </span>
  );
}
