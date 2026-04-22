"use client";

import Papa from "papaparse";
import { Bell, Loader2, NotepadText, Pencil, Plus, Trash2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tag = { id: number; name: string; color: string };
type Contact = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  createdAt?: string;
  followUpAt?: string | Date | null;
  followUpNote?: string | null;
  followUpSent?: boolean | null;
  tags: Tag[];
};
type Note = { id: number; body: string; createdAt: string; updatedAt?: string };
type TimelineItem = { type: string; description: string; occurredAt: string; metadata?: Record<string, string> };
type EngagementItem = {
  campaignId: number;
  subject: string;
  sentAt: string;
  opened: boolean;
  clicked: boolean;
  lastActivity: string;
};

const TAG_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}

function timelineEmoji(type: string) {
  if (type === "email_sent") return "📧";
  if (type === "email_opened") return "👁";
  if (type === "email_clicked") return "🔗";
  if (type === "note_added") return "📝";
  if (type === "tag_assigned") return "🏷";
  return "•";
}

function reminderLabel(contact: Contact) {
  if (!contact.followUpAt) return { text: "Set reminder", className: "", isButton: true };
  const date = new Date(contact.followUpAt);
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (contact.followUpSent) {
    return { text: "✅ Reminded", className: "text-emerald-600", isButton: false };
  }
  if (date <= new Date()) {
    return { text: `⚠️ Overdue: ${formatted}`, className: "text-red-600", isButton: false };
  }
  return { text: `🕐 ${formatted}`, className: "text-amber-600", isButton: false };
}

export function ContactsManager({
  listId,
  initialContacts,
  initialEngagement,
}: {
  listId: number;
  initialContacts: Contact[];
  initialEngagement: Record<string, "opened" | "sent" | null>;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [engagementMap, setEngagementMap] = useState(initialEngagement);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [popoverOpenFor, setPopoverOpenFor] = useState<number | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [creatingTag, setCreatingTag] = useState(false);

  const [notesOpen, setNotesOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  const [sheetTab, setSheetTab] = useState<"notes" | "timeline" | "engagement">("notes");
  const [timelineByContact, setTimelineByContact] = useState<Record<number, TimelineItem[]>>({});
  const [timelineLoadingByContact, setTimelineLoadingByContact] = useState<Record<number, boolean>>({});
  const [timelineLoadedByContact, setTimelineLoadedByContact] = useState<Record<number, boolean>>({});

  const [engagementByContact, setEngagementByContact] = useState<Record<number, EngagementItem[]>>({});
  const [engagementLoadingByContact, setEngagementLoadingByContact] = useState<Record<number, boolean>>({});
  const [engagementLoadedByContact, setEngagementLoadedByContact] = useState<Record<number, boolean>>({});

  const [openReminderForContactId, setOpenReminderForContactId] = useState<number | null>(null);
  const [reminderDateByContact, setReminderDateByContact] = useState<Record<number, string>>({});
  const [reminderNoteByContact, setReminderNoteByContact] = useState<Record<number, string>>({});
  const [savingReminderFor, setSavingReminderFor] = useState<number | null>(null);
  const [clearingReminderFor, setClearingReminderFor] = useState<number | null>(null);

  const filteredContacts = useMemo(() => {
    if (!selectedTagIds.length) return contacts;
    return contacts.filter((contact) => contact.tags.some((tag) => selectedTagIds.includes(tag.id)));
  }, [contacts, selectedTagIds]);

  async function fetchContacts() {
    const res = await fetch(`/api/individual/lists/${listId}/contacts`);
    if (!res.ok) return;
    const data = await res.json();
    const nextContacts = (data.contacts ?? []).map((c: any) => ({ ...c, createdAt: c.createdAt }));
    setContacts(nextContacts);

    const emails = nextContacts.map((c: Contact) => c.email);
    if (!emails.length) return;
    const updatedEngagement: Record<string, "opened" | "sent" | null> = {};
    for (const c of nextContacts) {
      updatedEngagement[c.email] = engagementMap[c.email] ?? null;
    }
    setEngagementMap(updatedEngagement);
  }

  async function fetchTags() {
    if (tagsLoaded) return;
    const res = await fetch("/api/individual/tags");
    if (!res.ok) return;
    const data = await res.json();
    setTags(data ?? []);
    setTagsLoaded(true);
  }

  async function submitAddContact(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    const res = await fetch(`/api/individual/lists/${listId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to add contact");
      return;
    }
    toast.success("Contact added");
    setName("");
    setEmail("");
    setPhone("");
    await fetchContacts();
  }

  async function openNotes(contact: Contact, open: boolean) {
    setNotesOpen(open);
    if (!open) return;
    setActiveContact(contact);
    setSheetTab("notes");
    setNotesLoading(true);
    const res = await fetch(`/api/individual/contacts/${contact.id}/notes`);
    const data = await res.json();
    setNotes(data ?? []);
    setNotesLoading(false);
  }

  async function maybeLoadTimeline(contactId: number) {
    if (timelineLoadedByContact[contactId]) return;
    setTimelineLoadingByContact((prev) => ({ ...prev, [contactId]: true }));
    const res = await fetch(`/api/individual/contacts/${contactId}/timeline`);
    const data = await res.json();
    if (!res.ok) {
      setTimelineLoadingByContact((prev) => ({ ...prev, [contactId]: false }));
      toast.error(data.error || "Failed to load timeline");
      return;
    }
    setTimelineByContact((prev) => ({ ...prev, [contactId]: data ?? [] }));
    setTimelineLoadedByContact((prev) => ({ ...prev, [contactId]: true }));
    setTimelineLoadingByContact((prev) => ({ ...prev, [contactId]: false }));
  }

  async function maybeLoadEngagement(contactId: number) {
    if (engagementLoadedByContact[contactId]) return;
    setEngagementLoadingByContact((prev) => ({ ...prev, [contactId]: true }));
    const res = await fetch(`/api/individual/contacts/${contactId}/engagement`);
    const data = await res.json();
    if (!res.ok) {
      setEngagementLoadingByContact((prev) => ({ ...prev, [contactId]: false }));
      toast.error(data.error || "Failed to load engagement");
      return;
    }
    setEngagementByContact((prev) => ({ ...prev, [contactId]: data ?? [] }));
    setEngagementLoadedByContact((prev) => ({ ...prev, [contactId]: true }));
    setEngagementLoadingByContact((prev) => ({ ...prev, [contactId]: false }));
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Add Contact</h2>
        <form onSubmit={submitAddContact} className="flex flex-col sm:flex-row gap-3 items-end">
          <input value={name} onChange={(e) => setName(e.target.value)} name="name" type="text" required maxLength={100} placeholder="Full name" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} name="email" type="email" required maxLength={255} placeholder="Email address" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex-1 w-full">
            <label className="block text-xs text-muted-foreground mb-1">Phone (optional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} name="phone" type="tel" placeholder="+91 98765 43210" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button type="submit" disabled={adding} className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity shrink-0">{adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}</button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <button type="button" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors shrink-0">Import CSV</button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Import CSV</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <input type="file" accept=".csv" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImportFile(file);
                  Papa.parse(file, {
                    header: true,
                    preview: 3,
                    complete: (results) => {
                      setPreviewRows(results.data as Record<string, string>[]);
                      setDetectedColumns(results.meta.fields ?? []);
                    },
                  });
                }} />
                <p className="text-sm text-muted-foreground">Detected columns: {detectedColumns.join(", ")}</p>
                <div className="rounded-md border border-border overflow-auto">
                  <table className="w-full text-xs"><tbody>{previewRows.slice(0, 3).map((row, idx) => (<tr key={idx} className="border-b border-border last:border-0">{Object.values(row).map((cell, j) => (<td key={j} className="px-2 py-1">{String(cell ?? "")}</td>))}</tr>))}</tbody></table>
                </div>
                <button type="button" disabled={importing || !importFile} className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm" onClick={async () => {
                  if (!importFile) return;
                  setImporting(true);
                  const formData = new FormData();
                  formData.append("file", importFile);
                  formData.append("listId", String(listId));
                  const res = await fetch("/api/individual/contacts/import", { method: "POST", body: formData });
                  const data = await res.json();
                  setImporting(false);
                  if (!res.ok) {
                    toast.error(data.error || "Import failed");
                    return;
                  }
                  toast.success(`Imported ${data.imported} contacts, updated ${data.updated}. ${data.limitSkipped > 0 ? `${data.limitSkipped} skipped (plan limit).` : ""}`);
                  setImportOpen(false);
                  await fetchContacts();
                }}>{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Import"}</button>
              </div>
            </DialogContent>
          </Dialog>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Contacts ({filteredContacts.length})</h2>

        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-muted-foreground">Filter by tag:</span>
          <Popover open={popoverOpenFor === -1} onOpenChange={async (open) => { if (open) await fetchTags(); setPopoverOpenFor(open ? -1 : null); }}>
            <PopoverTrigger asChild>
              <button type="button" className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-secondary transition-colors">{selectedTagIds.length ? `${selectedTagIds.length} tag(s) selected` : "All tags"}</button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-2">{tags.map((tag) => (<label key={tag.id} className="flex items-center gap-2 text-sm"><Checkbox checked={selectedTagIds.includes(tag.id)} onCheckedChange={(checked) => setSelectedTagIds((prev) => checked ? [...prev, tag.id] : prev.filter((id) => id !== tag.id))} /><span style={{ backgroundColor: `${tag.color}33`, color: tag.color, fontSize: 11, padding: "2px 7px", borderRadius: 9999 }}>{tag.name}</span></label>))}</div>
            </PopoverContent>
          </Popover>
          {selectedTagIds.length > 0 && (<button type="button" onClick={() => setSelectedTagIds([])} className="text-xs text-muted-foreground hover:text-foreground">Clear filters</button>)}
        </div>

        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed border-border">
            <p className="font-medium text-foreground">No contacts yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first contact using the form above.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Added</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reminder</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => {
                  const engagement = engagementMap[contact.email];
                  const dotColor = engagement === "opened" ? "#10b981" : engagement === "sent" ? "#9ca3af" : null;
                  const reminder = reminderLabel(contact);
                  return (
                    <Fragment key={contact.id}>
                      <tr className="border-b border-border hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {dotColor ? <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: dotColor, marginRight: 6 }} /> : null}
                          <span>{contact.name}</span>
                          {contact.tags.map((tag) => (<span key={tag.id} className="ml-2" style={{ backgroundColor: `${tag.color}33`, color: tag.color, fontSize: 11, padding: "2px 7px", borderRadius: 9999 }}>{tag.name}</span>))}
                          <Popover open={popoverOpenFor === contact.id} onOpenChange={async (open) => { if (open) await fetchTags(); setPopoverOpenFor(open ? contact.id : null); }}>
                            <PopoverTrigger asChild><button type="button" className="ml-2 inline-flex items-center justify-center rounded border border-border h-5 w-5" title="Manage tags"><Plus className="h-3 w-3" /></button></PopoverTrigger>
                            <PopoverContent>
                              <div className="space-y-2">
                                {tags.map((tag) => (
                                  <label key={tag.id} className="flex items-center gap-2 text-sm">
                                    <Checkbox checked={contact.tags.some((t) => t.id === tag.id)} onCheckedChange={async (checked) => {
                                      const res = await fetch(`/api/individual/contacts/${contact.id}/tags`, { method: checked ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tagId: tag.id }) });
                                      if (!res.ok) return toast.error("Failed to update tag assignment");
                                      setContacts((prev) => prev.map((c) => c.id !== contact.id ? c : { ...c, tags: checked ? [...c.tags, tag] : c.tags.filter((t) => t.id !== tag.id) }));
                                      toast.success(checked ? "Tag assigned" : "Tag removed");
                                    }} />
                                    <span style={{ backgroundColor: `${tag.color}33`, color: tag.color, fontSize: 11, padding: "2px 7px", borderRadius: 9999 }}>{tag.name}</span>
                                  </label>
                                ))}
                                <div className="pt-2 border-t border-border">
                                  <p className="text-xs mb-2">Create new tag</p>
                                  <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} maxLength={50} className="w-full rounded border border-input px-2 py-1 text-xs mb-2" placeholder="Tag name" />
                                  <div className="flex gap-2 mb-2">{TAG_COLORS.map((color) => (<button key={color} type="button" onClick={() => setNewTagColor(color)} className={`h-5 w-5 rounded-full ${newTagColor === color ? "ring-2 ring-offset-1 ring-foreground" : ""}`} style={{ backgroundColor: color }} />))}</div>
                                  <button type="button" className="text-xs rounded border border-border px-2 py-1" disabled={creatingTag} onClick={async () => {
                                    setCreatingTag(true);
                                    const tagRes = await fetch("/api/individual/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newTagName, color: newTagColor }) });
                                    const tagData = await tagRes.json();
                                    if (!tagRes.ok) {
                                      setCreatingTag(false);
                                      toast.error(tagData.error || "Failed to create tag");
                                      return;
                                    }
                                    const createdTag = tagData as Tag;
                                    await fetch(`/api/individual/contacts/${contact.id}/tags`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tagId: createdTag.id }) });
                                    setTags((prev) => [...prev, createdTag]);
                                    setContacts((prev) => prev.map((c) => c.id === contact.id ? { ...c, tags: [...c.tags, createdTag] } : c));
                                    setNewTagName("");
                                    setCreatingTag(false);
                                    toast.success("Tag created and assigned");
                                  }}>{creatingTag ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}</button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{contact.email}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{contact.createdAt ? new Date(contact.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-"}</td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => {
                            const isOpen = openReminderForContactId === contact.id;
                            setOpenReminderForContactId(isOpen ? null : contact.id);
                            if (isOpen) return;
                            const existingDate = contact.followUpAt ? new Date(contact.followUpAt).toISOString().slice(0, 10) : "";
                            setReminderDateByContact((prev) => ({ ...prev, [contact.id]: existingDate }));
                            setReminderNoteByContact((prev) => ({ ...prev, [contact.id]: contact.followUpNote || "" }));
                          }} className={reminder.isButton ? "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs" : `text-xs ${reminder.className}`}>
                            {reminder.isButton ? <Bell size={14} /> : null}
                            <span className={reminder.isButton ? "hidden md:inline" : ""}>{reminder.text}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Sheet open={notesOpen && activeContact?.id === contact.id} onOpenChange={(open) => openNotes(contact, open)}>
                              <SheetTrigger asChild><button type="button" title="Notes"><NotepadText className="h-4 w-4" /></button></SheetTrigger>
                              <SheetContent side="right">
                                <SheetHeader><SheetTitle>Notes — {contact.name}</SheetTitle></SheetHeader>
                                <Tabs value={sheetTab} onValueChange={async (nextTab) => {
                                  const selected = nextTab as "notes" | "timeline" | "engagement";
                                  setSheetTab(selected);
                                  if (selected === "timeline") await maybeLoadTimeline(contact.id);
                                  if (selected === "engagement") await maybeLoadEngagement(contact.id);
                                }} defaultValue="notes" className="mt-3">
                                  <TabsList>
                                    <TabsTrigger value="notes">Notes</TabsTrigger>
                                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                                    <TabsTrigger value="engagement">Engagement</TabsTrigger>
                                  </TabsList>
                                  <TabsContent value="notes" className="space-y-3">
                                    {notesLoading ? (<><Skeleton className="h-4" /><Skeleton className="h-4" /><Skeleton className="h-4" /></>) : notes.length === 0 ? (<p className="text-sm text-muted-foreground">No notes yet. Add the first one below.</p>) : notes.map((note) => (
                                      <div key={note.id} className="rounded border border-border p-2">
                                        <p className="text-sm">{editingNoteId === note.id ? editingText : note.body}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                                        {editingNoteId === note.id ? (
                                          <div className="mt-2">
                                            <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="w-full rounded border border-input px-2 py-1 text-sm" />
                                            <button type="button" className="mt-1 text-xs rounded border border-border px-2 py-1" onClick={async () => {
                                              const res = await fetch(`/api/individual/contacts/${contact.id}/notes`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId: note.id, body: editingText }) });
                                              const data = await res.json();
                                              if (!res.ok) return toast.error(data.error || "Update failed");
                                              setNotes((prev) => prev.map((n) => (n.id === note.id ? data : n)));
                                              setEditingNoteId(null);
                                              setEditingText("");
                                              toast.success("Note updated");
                                            }}>Save</button>
                                          </div>
                                        ) : (<div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => { setEditingNoteId(note.id); setEditingText(note.body); }}><Pencil className="h-[14px] w-[14px]" /></button><button type="button" onClick={async () => {
                                          const res = await fetch(`/api/individual/contacts/${contact.id}/notes`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId: note.id }) });
                                          if (!res.ok) return toast.error("Failed to delete note");
                                          setNotes((prev) => prev.filter((n) => n.id !== note.id));
                                          toast.success("Note deleted");
                                        }}><Trash2 className="h-[14px] w-[14px]" /></button></div>)}
                                      </div>
                                    ))}
                                    <div className="mt-4">
                                      <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="w-full rounded border border-input px-3 py-2 text-sm" />
                                      <button type="button" disabled={savingNote} className="mt-2 rounded border border-border px-3 py-2 text-sm" onClick={async () => {
                                        setSavingNote(true);
                                        const res = await fetch(`/api/individual/contacts/${contact.id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: newNote }) });
                                        const data = await res.json();
                                        setSavingNote(false);
                                        if (!res.ok) return toast.error(data.error || "Failed to save note");
                                        setNotes((prev) => [data, ...prev]);
                                        setNewNote("");
                                        toast.success("Note added");
                                      }}>{savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Note"}</button>
                                    </div>
                                  </TabsContent>
                                  <TabsContent value="timeline" className="space-y-3">
                                    {timelineLoadingByContact[contact.id] ? (<><Skeleton className="h-6" /><Skeleton className="h-6" /><Skeleton className="h-6" /></>) : (timelineByContact[contact.id] ?? []).length === 0 ? (<p className="text-sm text-muted-foreground">No activity yet — send a campaign or add a note to get started.</p>) : (timelineByContact[contact.id] ?? []).map((item, idx) => {
                                      const occurred = new Date(item.occurredAt);
                                      return (
                                        <div key={`${item.type}-${idx}`} className="flex items-center justify-between gap-3 rounded border border-border p-2">
                                          <p className="text-sm"><span className="mr-2">{timelineEmoji(item.type)}</span>{item.description}</p>
                                          <span className="text-xs text-muted-foreground" title={occurred.toISOString()}>{formatRelativeTime(occurred)}</span>
                                        </div>
                                      );
                                    })}
                                  </TabsContent>
                                  <TabsContent value="engagement" className="space-y-3">
                                    {engagementLoadingByContact[contact.id] ? (<><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></>) : (engagementByContact[contact.id] ?? []).length === 0 ? (<p className="text-sm text-muted-foreground">No emails sent to this contact yet.</p>) : (engagementByContact[contact.id] ?? []).map((item) => (
                                      <div key={item.campaignId} className="rounded border border-border p-3 space-y-2">
                                        <p className="font-medium text-sm">{item.subject}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(item.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          {item.opened ? <span className="text-xs rounded-full px-2 py-1 bg-emerald-100 text-emerald-700">✅ Opened</span> : <span className="text-xs rounded-full px-2 py-1 bg-gray-100 text-gray-700">📧 Sent · Not opened</span>}
                                          {item.clicked ? <span className="text-xs rounded-full px-2 py-1 bg-blue-100 text-blue-700">🔗 Clicked</span> : null}
                                        </div>
                                      </div>
                                    ))}
                                  </TabsContent>
                                </Tabs>
                              </SheetContent>
                            </Sheet>

                            <button type="button" title="Delete" onClick={async () => {
                              const res = await fetch(`/api/individual/lists/${listId}/contacts/${contact.id}`, { method: "DELETE" });
                              if (!res.ok) return toast.error("Failed to delete contact");
                              setContacts((prev) => prev.filter((c) => c.id !== contact.id));
                              toast.success("Contact deleted");
                            }}><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                      {openReminderForContactId === contact.id && (
                        <tr className="border-b border-border last:border-0">
                          <td colSpan={5} className="px-4 py-3 bg-background">
                            <div className="grid gap-3 max-w-xl">
                              <input type="date" min={today} value={reminderDateByContact[contact.id] ?? ""} onChange={(e) => setReminderDateByContact((prev) => ({ ...prev, [contact.id]: e.target.value }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">What to follow up about (optional)</label>
                                <input type="text" value={reminderNoteByContact[contact.id] ?? ""} onChange={(e) => setReminderNoteByContact((prev) => ({ ...prev, [contact.id]: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" disabled={savingReminderFor === contact.id} className="rounded border border-border px-3 py-2 text-sm" onClick={async () => {
                                  const dayValue = reminderDateByContact[contact.id];
                                  if (!dayValue) return toast.error("Please choose a date");
                                  setSavingReminderFor(contact.id);
                                  const res = await fetch(`/api/individual/contacts/${contact.id}/reminder`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ followUpAt: `${dayValue}T09:00:00.000Z`, followUpNote: reminderNoteByContact[contact.id] ?? "" }),
                                  });
                                  const data = await res.json();
                                  setSavingReminderFor(null);
                                  if (!res.ok) return toast.error(data.error || "Failed to save reminder");
                                  setContacts((prev) => prev.map((c) => c.id === contact.id ? { ...c, followUpAt: data.followUpAt, followUpNote: data.followUpNote, followUpSent: data.followUpSent } : c));
                                  setOpenReminderForContactId(null);
                                  toast.success("Reminder set");
                                }}>{savingReminderFor === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Reminder"}</button>
                                {contact.followUpAt ? (
                                  <button type="button" disabled={clearingReminderFor === contact.id} className="rounded border border-border px-3 py-2 text-sm" onClick={async () => {
                                    setClearingReminderFor(contact.id);
                                    const res = await fetch(`/api/individual/contacts/${contact.id}/reminder`, { method: "DELETE" });
                                    const data = await res.json();
                                    setClearingReminderFor(null);
                                    if (!res.ok) return toast.error(data.error || "Failed to clear reminder");
                                    setContacts((prev) => prev.map((c) => c.id === contact.id ? { ...c, followUpAt: null, followUpNote: null, followUpSent: false } : c));
                                    setOpenReminderForContactId(null);
                                    toast.success("Reminder cleared");
                                  }}>{clearingReminderFor === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Clear Reminder"}</button>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
