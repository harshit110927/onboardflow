export default async function EmbedPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Embed</h1>
        <p className="mt-4 text-muted-foreground">
          Embed page for organization: {orgId}
        </p>
      </div>
    </div>
  );
}
