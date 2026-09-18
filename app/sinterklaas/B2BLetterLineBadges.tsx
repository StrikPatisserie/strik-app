import type { B2BLetterLine } from "./types";

export default function B2BLetterLineBadges({ lines }: Readonly<{ lines: B2BLetterLine[] }>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {lines.map((line) => (
        <div key={line.id} className="min-w-36 rounded-lg border border-[#d6e5d8] bg-white px-2.5 py-1.5 text-xs shadow-sm">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-black text-[#24551d]">{line.quantity}× {line.letter}</span>
            <span className="font-bold capitalize text-[#4d463d]">{line.chocolate}</span>
          </div>
          <p className="text-[0.68rem] font-semibold text-[#6b645b]">{line.style} · {line.size}</p>
          {line.exceptions.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{line.exceptions.map((exception) => <span key={exception} className="rounded bg-[#fff3c4] px-1.5 py-0.5 text-[0.62rem] font-black text-[#705000]">{exception}</span>)}</div>}
        </div>
      ))}
    </div>
  );
}
