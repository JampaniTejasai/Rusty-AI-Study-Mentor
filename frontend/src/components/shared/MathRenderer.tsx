import { useEffect, useRef } from "react";

interface Props {
  text: string;
  className?: string;
}

// KaTeX is lazy-loaded only when a $ delimiter is detected — saves ~350KB
let katexPromise: Promise<typeof import("katex")> | null = null;

function loadKatex() {
  if (!katexPromise) {
    katexPromise = import("katex").then((mod) => {
      // Also inject the KaTeX CSS once
      if (!document.getElementById("katex-css")) {
        const link = document.createElement("link");
        link.id = "katex-css";
        link.rel = "stylesheet";
        link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css";
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }
      return mod;
    });
  }
  return katexPromise;
}

export function MathRenderer({ text, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const hasMath = text.includes("$");

    if (!hasMath) {
      ref.current.textContent = text;
      return;
    }

    loadKatex().then((katex) => {
      if (!ref.current) return;
      // Split on $ delimiters and render math inline
      const parts = text.split(/(\$[^$]+\$)/g);
      ref.current.innerHTML = "";
      parts.forEach((part) => {
        if (part.startsWith("$") && part.endsWith("$")) {
          const mathExpr = part.slice(1, -1);
          const span = document.createElement("span");
          try {
            katex.default.render(mathExpr, span, {
              throwOnError: false,
              displayMode: false,
              strict: "warn",
              maxSize: 500,
              maxExpand: 100,
            });
          } catch {
            span.textContent = part;
          }
          ref.current!.appendChild(span);
        } else {
          ref.current!.appendChild(document.createTextNode(part));
        }
      });
    });
  }, [text]);

  return <span ref={ref} className={className} />;
}
