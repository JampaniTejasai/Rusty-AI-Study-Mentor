export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-rusty-cream border border-rusty-border rounded-xl p-4 space-y-3 overflow-hidden">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3.5 shimmer-line rounded-full"
          style={{ width: `${65 + (i % 3) * 12}%` }}
        />
      ))}
    </div>
  );
}
