import type { B2BLetterLine } from "./types";

export default function B2BLetterLineBadges({ lines }: Readonly<{ lines: B2BLetterLine[] }>) {
  return (
    <div className="flex flex-wrap gap-1">
      {lines.map((line) => (
        <div key={line.id} className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md border border-[#d6e5d8] bg-[#fbfdf9] px-2 py-1 text-[0.68rem] shadow-sm">
          <span className="font-black text-[#24551d]">{line.quantity}× {line.letter}</span>
          <span className="font-bold capitalize text-[#4d463d]">{line.chocolate}</span>
          <span className="font-semibold text-[#6b645b]">{line.style} · {line.size}</span>
          {line.exceptions.map((exception) => <span key={exception} className="rounded bg-[#fff3c4] px-1 py-0.5 text-[0.6rem] font-black text-[#705000]">{exception}</span>)}
        </div>
      ))}
    </div>
  );
}
