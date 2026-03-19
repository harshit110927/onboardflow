// NEW FILE — created for tier selection feature
export default function TierSelectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {children}
    </div>
  );
}
