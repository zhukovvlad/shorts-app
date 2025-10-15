"use client"

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";

type TranscriptProps = {
  text: string;
  className?: string;
  collapsedMaxHeight?: number; // in px
};

/**
 * Readable, accessible transcript block with expand/collapse.
 * No Tailwind line-clamp plugin required — uses max-height + gradient fade.
 */
export function Transcript({
  text,
  className,
  collapsedMaxHeight = 320,
}: TranscriptProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("w-full", className)}>
      <div className="w-fit">
        <div className="group relative mx-auto flex items-center justify-center rounded-full px-2 py-1.5 shadow-[inset_0_-8px_10px_#8fdfff1f] transition-shadow duration-500 ease-out hover:shadow-[inset_0_-5px_10px_#8fdfff3f] ">
          <span
            className={cn(
              "absolute inset-0 block h-full w-full animate-gradient rounded-[inherit] bg-gradient-to-r from-[#b0b0b0]/50 via-[#9c40ff]/50 to-[#b0b0b0]/50 bg-[length:300%_100%] p-[1px]",
            )}
            style={{
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "destination-out",
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "subtract",
              WebkitClipPath: "padding-box",
            }}
          />

          <AnimatedGradientText className="text-sm font-medium">
            Transcript
          </AnimatedGradientText>
        </div>
      </div>

      <div
        className={cn(
          "relative mt-4 rounded-md bg-neutral-900/60 backdrop-blur-sm border border-white/10 w-full max-w-3xl transition-all",
          expanded ? "overflow-visible" : "overflow-hidden",
        )}
        style={!expanded ? { maxHeight: collapsedMaxHeight } : undefined}
      >
        {/* content */}
        <div className="p-4">
          <p className="text-sm leading-7 text-gray-100/90 whitespace-pre-wrap break-words">
            {text}
          </p>
        </div>

        {/* bottom gradient fade when collapsed */}
        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-neutral-900/80 via-neutral-900/40 to-transparent" />
        )}
      </div>

      {/* toggle */}
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-white/80 hover:text-white transition-colors underline underline-offset-4 cursor-pointer"
          aria-expanded={expanded}
          aria-controls="transcript-content"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      </div>
    </div>
  );
}
