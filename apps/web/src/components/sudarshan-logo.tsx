import { cn } from '../lib/format';

// Asymmetric teeth so the disc reads as turning.
const TEETH =
  '12.20,0.00 15.39,2.52 11.78,3.16 14.22,6.42 10.57,6.10 12.07,9.88 8.63,8.63 9.10,12.67 6.10,10.57 5.51,14.59 3.16,11.78 1.55,15.52 0.00,12.20 -2.52,15.39 -3.16,11.78 -6.42,14.22 -6.10,10.57 -9.88,12.07 -8.63,8.63 -12.67,9.10 -10.57,6.10 -14.59,5.51 -11.78,3.16 -15.52,1.55 -12.20,0.00 -15.39,-2.52 -11.78,-3.16 -14.22,-6.42 -10.57,-6.10 -12.07,-9.88 -8.63,-8.63 -9.10,-12.67 -6.10,-10.57 -5.51,-14.59 -3.16,-11.78 -1.55,-15.52 -0.00,-12.20 2.52,-15.39 3.16,-11.78 6.42,-14.22 6.10,-10.57 9.88,-12.07 8.63,-8.63 12.67,-9.10 10.57,-6.10 14.59,-5.51 11.78,-3.16 15.52,-1.55';

const SPOKES = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);

export function SudarshanMark({ size = 28, spinning = false, className }: { size?: number; spinning?: boolean; className?: string }) {
  return (
    <svg
      viewBox="-16 -16 32 32"
      width={size}
      height={size}
      role="img"
      aria-label="Sudarshan"
      className={cn(spinning && 'chakra-spin', className)}
    >
      <polygon points={TEETH} fill="var(--accent)" />
      <circle r="10.6" fill="var(--chakra-core)" />
      <circle r="7.6" fill="none" stroke="var(--accent)" strokeWidth="1.3" />
      {SPOKES.map((a) => (
        <line
          key={a}
          x1={Math.cos(a) * 2.6}
          y1={Math.sin(a) * 2.6}
          x2={Math.cos(a) * 7.6}
          y2={Math.sin(a) * 7.6}
          stroke="var(--accent)"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      ))}
      <circle r="2.5" fill="var(--accent)" />
      <circle r="0.9" fill="var(--chakra-core)" />
    </svg>
  );
}
