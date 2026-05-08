import ManagementGate from "./ManagementGate";

export default function ManagementLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ManagementGate>{children}</ManagementGate>;
}
