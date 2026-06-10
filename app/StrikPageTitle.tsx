export default function StrikPageTitle({
  title,
}: Readonly<{
  title: string;
}>) {
  return (
    <h1 className="max-w-full text-3xl font-black tracking-tight text-[#1a1815] sm:text-4xl">
      {title}
    </h1>
  );
}
