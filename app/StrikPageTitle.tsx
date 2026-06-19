export default function StrikPageTitle({
  title,
}: Readonly<{
  title: string;
}>) {
  return <h1 className="strik-page-title max-w-full">{title}</h1>;
}
