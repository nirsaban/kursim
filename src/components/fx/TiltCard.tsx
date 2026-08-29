import { cn } from '@/lib/cn';

/**
 * Flat card wrapper — kept as a drop-in for former pointer-tracked 3D tilt
 * call sites. The Udemy-style redesign is flat (no 3D tilt/glare), so this
 * now just renders children in a plain div; `maxTilt`/`glare` are accepted
 * for API compatibility but no longer affect rendering.
 */
export default function TiltCard({
  children,
  className,
  maxTilt: _maxTilt = 7,
  glare: _glare = true,
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
}) {
  return <div className={cn('relative', className)}>{children}</div>;
}
