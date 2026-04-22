"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tag = { id: number; name: string; color: string };
type EndUser = { id: string; email: string | null; externalId: string; tags: Tag[] };
type Note = { id: number; body: string; createdAt: string };

export function EnterpriseUsersPanel({ initialUsers }: { initialUsers: EndUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [activeUser, setActiveUser] = useState<EndUser | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [updatingNoteId, setUpdatingNoteId] = useState<number | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [popoverOpenFor, setPopoverOpenFor] = useState<string | null>(null);

  async function fetchTenantTags() {
    if (tagsLoaded) return;
    const res = await fetch("/api/individual/tags");
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to load tags");
      return;
    }
    setTags(data ?? []);
    setTagsLoaded(true);
  }

  async function openUserSheet(user: EndUser, open: boolean) {
    setSheetOpen(open);
    if (!open) return;
    setActiveUser(user);
    setNotesLoading(true);
    const res = await fetch(`/api/enterprise/users/${user.id}/notes`);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to load notes");
      setNotesLoading(false);
      return;
    }
    setNotes(data ?? []);
    setNotesLoading(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Email</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tags</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <Sheet key={user.id} open={sheetOpen && activeUser?.id === user.id} onOpenChange={(open) => openUserSheet(user, open)}>
              <SheetTrigger asChild>
                <tr className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-medium text-foreground">{user.externalId || user.email || user.id}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{user.email || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {user.tags.map((tag) => (
                        <span key={tag.id} style={{ backgroundColor: `${tag.color}33`, color: tag.color, fontSize: 11, padding: "2px 7px", borderRadius: 9999 }}>
                          {tag.name}
                        </span>
                      ))}
                      <Popover open={popoverOpenFor === user.id} onOpenChange={async (open) => { if (open) await fetchTenantTags(); setPopoverOpenFor(open ? user.id : null); }}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded border border-border h-5 w-5"
                            title="Manage tags"
                            onClick={(e: MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
                          <div className="space-y-2">
                            {tags.map((tag) => (
                              <label key={tag.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={user.tags.some((t) => t.id === tag.id)}
                                  onCheckedChange={async (checked) => {
                                    const res = await fetch(`/api/enterprise/users/${user.id}/tags`, {
                                      method: checked ? "POST" : "DELETE",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ tagId: tag.id }),
                                    });
                                    const data = await res.json();
                                    if (!res.ok) {
                                      toast.error(data.error || "Failed to update tag assignment");
                                      return;
                                    }
                                    setUsers((prev) => prev.map((u) => u.id !== user.id ? u : { ...u, tags: checked ? [...u.tags, tag] : u.tags.filter((t) => t.id !== tag.id) }));
                                    toast.success(checked ? "Tag assigned" : "Tag removed");
                                  }}
                                />
                                <span style={{ backgroundColor: `${tag.color}33`, color: tag.color, fontSize: 11, padding: "2px 7px", borderRadius: 9999 }}>{tag.name}</span>
                              </label>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </td>
                </tr>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>{activeUser?.externalId || activeUser?.email || activeUser?.id}</SheetTitle>
                </SheetHeader>
                <Tabs defaultValue="notes" className="mt-3">
                  <TabsList>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                  </TabsList>
                  <TabsContent value="notes" className="space-y-3">
                    {notesLoading ? (
                      <>
                        <Skeleton className="h-4" />
                        <Skeleton className="h-4" />
                        <Skeleton className="h-4" />
                      </>
                    ) : notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No notes yet. Add the first one below.</p>
                    ) : notes.map((note) => (
                      <div key={note.id} className="rounded border border-border p-2">
                        <p className="text-sm">{editingNoteId === note.id ? editingText : note.body}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        {editingNoteId === note.id ? (
                          <div className="mt-2">
                            <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="w-full rounded border border-input px-2 py-1 text-sm" />
                            <button type="button" disabled={updatingNoteId === note.id} className="mt-1 text-xs rounded border border-border px-2 py-1" onClick={async () => {
                              setUpdatingNoteId(note.id);
                              const res = await fetch(`/api/enterprise/users/${user.id}/notes`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId: note.id, body: editingText }) });
                              const data = await res.json();
                              setUpdatingNoteId(null);
                              if (!res.ok) return toast.error(data.error || "Update failed");
                              setNotes((prev) => prev.map((n) => (n.id === note.id ? data : n)));
                              setEditingNoteId(null);
                              setEditingText("");
                              toast.success("Note updated");
                            }}>{updatingNoteId === note.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}</button>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center gap-2">
                            <button type="button" onClick={() => { setEditingNoteId(note.id); setEditingText(note.body); }}><Pencil className="h-[14px] w-[14px]" /></button>
                            <button type="button" disabled={deletingNoteId === note.id} onClick={async () => {
                              setDeletingNoteId(note.id);
                              const res = await fetch(`/api/enterprise/users/${user.id}/notes`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId: note.id }) });
                              const data = await res.json();
                              setDeletingNoteId(null);
                              if (!res.ok) return toast.error(data.error || "Failed to delete note");
                              setNotes((prev) => prev.filter((n) => n.id !== note.id));
                              toast.success("Note deleted");
                            }}>{deletingNoteId === note.id ? <Loader2 className="h-[14px] w-[14px] animate-spin" /> : <Trash2 className="h-[14px] w-[14px]" />}</button>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="mt-4">
                      <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="w-full rounded border border-input px-3 py-2 text-sm" />
                      <button type="button" disabled={savingNote} className="mt-2 rounded border border-border px-3 py-2 text-sm" onClick={async () => {
                        if (!activeUser) return;
                        setSavingNote(true);
                        const res = await fetch(`/api/enterprise/users/${activeUser.id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: newNote }) });
                        const data = await res.json();
                        setSavingNote(false);
                        if (!res.ok) return toast.error(data.error || "Failed to save note");
                        setNotes((prev) => [data, ...prev]);
                        setNewNote("");
                        toast.success("Note added");
                      }}>
                        {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Note"}
                      </button>
                    </div>
                  </TabsContent>
                </Tabs>
              </SheetContent>
            </Sheet>
          ))}
        </tbody>
      </table>
    </div>
  );
}
