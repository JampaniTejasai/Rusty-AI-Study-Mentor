interface Props {
  label?: string;
  sublabel?: string;
}

export function AILoader({ label = "Rusty is thinking…", sublabel }: Props) {
  return (
    <div className="flex justify-start w-full">
      <div className="bg-rusty-ai-soft border border-rusty-ai/20 rounded-2xl rounded-tl-sm px-4 py-4 w-full max-w-[95%] space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-rusty-ai rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-bold">R</span>
          </div>
          <span className="text-xs font-semibold text-rusty-ai">{label}</span>
          <span className="flex gap-1 ml-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 bg-rusty-ai/60 rounded-full"
                style={{ animation: `bounce-dot 1.2s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </span>
        </div>
        {sublabel && (
          <p className="text-[11px] text-rusty-ai/60">{sublabel}</p>
        )}
        <div className="space-y-2.5">
          <div className="h-3 shimmer-line rounded-full w-[88%]" />
          <div className="h-3 shimmer-line rounded-full w-[72%]" />
          <div className="h-3 shimmer-line rounded-full w-[80%]" />
        </div>
      </div>
    </div>
  );
}

export function TestGenLoader({ step }: { step: number }) {
  const steps = [
    "Selecting Bihar Board questions…",
    "Building your 5-question test…",
    "Adding explanations…",
    "Almost ready…",
  ];
  const current = steps[step % steps.length];

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-5">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-2xl bg-rusty-ai-soft flex items-center justify-center">
          <span className="text-3xl" style={{ animation: "spin 2s linear infinite", display: "inline-block" }}>⚙️</span>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-rusty-ink font-semibold text-sm">{current}</p>
        <p className="text-rusty-muted text-xs">Sourced from Bihar Board textbook</p>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-rusty-ai rounded-full"
            style={{ animation: `bounce-dot 1.2s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
