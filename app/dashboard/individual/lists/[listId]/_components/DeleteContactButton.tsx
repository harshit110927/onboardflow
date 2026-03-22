"use client";

export function DeleteContactButton({
  contactId,
  listId,
  contactName,
  deleteAction,
}: {
  contactId: number;
  listId: number;
  contactName: string;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={deleteAction}
      onSubmit={(e) => {
        if (!confirm(`Remove ${contactName} from this list?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="listId" value={listId} />
      <button
        type="submit"
        className="text-xs rounded-md border border-destructive/40 text-destructive px-2.5 py-1 hover:bg-destructive/10 transition-colors"
      >
        Remove
      </button>
    </form>
  );
}