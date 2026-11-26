import Link from 'next/link';
export default function PersoonlijkeNootLink() {
  return <Link href="/winkel/persoonlijke-noot" className="my-3 inline-flex min-h-16 items-center gap-3 rounded-xl border border-[#d4d6b7] bg-[#fffcdf] px-4 py-2 text-[#493d21] transition hover:bg-[#fff7c0] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#493d21]">
    <svg width="25" height="30" viewBox="0 0 24 30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M9 23V6l12-3v17M9 10l12-3"/><ellipse cx="5.5" cy="23.5" rx="3.5" ry="2.5"/><ellipse cx="17.5" cy="20.5" rx="3.5" ry="2.5"/></svg>
    <span><strong className="block text-sm">Persoonlijke Noot</strong><span className="block text-xs text-[#7d7859]">Bestellingen afhalen</span></span><span aria-hidden="true" className="ml-3">→</span>
  </Link>;
}
