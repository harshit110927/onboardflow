"use client";

export function DeleteCampaignButton({
  campaignId,
  campaignSubject,
  deleteAction,
}: {
  campaignId: number;
  campaignSubject: string;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={deleteAction}
      onSubmit={(e) => {
        if (!confirm(`Delete "${campaignSubject}"?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="campaignId" value={campaignId} />
      <button
        type="submit"
        className="text-sm rounded-md border border-destructive/40 text-destructive px-3 py-1.5 hover:bg-destructive/10 transition-colors"
      >
        Delete
      </button>
    </form>
  );
}