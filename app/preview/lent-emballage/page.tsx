import { notFound } from 'next/navigation';
import { LentEmballageCard } from '../../winkel/LentEmballageNotice';

export default function Preview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <main className="min-h-dvh bg-[#c3d3bc] p-8 text-[#49342d]">
    <p className="text-sm">Voorbeeld · Winkel Lent</p>
    <h1 className="mt-3 text-3xl font-black">Goedemorgen, Lent</h1>
    <LentEmballageCard now={new Date('2026-11-26T08:00:00+01:00')} notice={{ date:'2026-11-26',expectedTime:'09:30',conditional:true,provisional:false,routeUpdatedAt:'2026-11-26T07:00:00Z' }} />
    <p className="mt-8 max-w-xl text-sm">Testweergave met voorbeeldtijd; dit verandert de echte route niet.</p>
  </main>;
}
