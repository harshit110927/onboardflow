"use client";

export function DeleteListButton({
  listId,
  listName,
  deleteAction,
}: {
  listId: number;
  listName: string;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={deleteAction}
      onSubmit={(e) => {
        if (!confirm(`Delete "${listName}"? This will remove all contacts and campaigns.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="listId" value={listId} />
      <button
        type="submit"
        className="text-sm rounded-md border border-destructive/40 text-destructive px-3 py-1.5 hover:bg-destructive/10 transition-colors"
      >
        Delete
      </button>
    </form>
  );
}