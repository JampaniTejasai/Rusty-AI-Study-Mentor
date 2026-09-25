import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../stores/AuthContext";
import { adminApi } from "../../api";
import { ApiError } from "../../api/client";
import type { Subject, TextbookEntry } from "../../types";

const SUBJECTS: { value: Subject; label: string }[] = [
  { value: "mathematics", label: "Mathematics" },
  { value: "science", label: "Science" },
  { value: "hindi", label: "Hindi" },
  { value: "social_science", label: "Social Science" },
  { value: "english", label: "English" },
];

interface Props { onBack: () => void }

function StatusBadge({ status }: { status: TextbookEntry["status"] }) {
  const styles = {
    ready: "bg-rusty-success-soft text-rusty-success-dark",
    processing: "bg-rusty-ai-soft text-rusty-ai",
    failed: "bg-rusty-danger-soft text-rusty-danger-dark",
  };
  const labels = { ready: "Ready", processing: "Processing…", failed: "Failed" };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function TextbookCard({
  book,
  onDelete,
  deleting,
}: {
  book: TextbookEntry;
  onDelete: (id: string) => void;
  deleting: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-rusty-cream border border-rusty-border rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-rusty-ink truncate">{book.original_filename}</p>
        </div>
        <StatusBadge status={book.status} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rusty-ai-soft text-rusty-ai">
          Class {book.class_num}
        </span>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rusty-green-soft text-rusty-green-dark capitalize">
          {book.subject.replace("_", " ")}
        </span>
        {book.chapter && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rusty-warning-soft text-rusty-warning-dark">
            {book.chapter}
          </span>
        )}
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rusty-cream border border-rusty-border text-rusty-ink">
          {book.language === "hi" ? "हिंदी" : "English"}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-rusty-muted">
        <span>
          {book.status === "ready" && `${book.chunk_count} passages indexed`}
          {book.status === "processing" && "Extracting & embedding…"}
          {book.status === "failed" && (book.error_message ?? "Ingestion failed")}
        </span>
        {book.uploaded_at && (
          <span>{new Date(book.uploaded_at).toLocaleDateString()}</span>
        )}
      </div>

      {book.status !== "processing" && (
        <div className="pt-1">
          {confirmDelete ? (
            <div className="flex gap-2">
              <button
                onClick={() => { onDelete(book.textbook_id); setConfirmDelete(false); }}
                disabled={deleting === book.textbook_id}
                className="flex-1 py-2 bg-rusty-danger text-white text-xs font-semibold rounded-lg
                           disabled:opacity-50 min-h-[36px]"
              >
                {deleting === book.textbook_id ? "Deleting…" : "Yes, delete all chunks"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 border border-rusty-border text-rusty-ink text-xs rounded-lg min-h-[36px]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-rusty-danger hover:underline focus:outline-none"
            >
              Delete & remove embeddings
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PdfUpload({ onBack }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [classNum, setClassNum] = useState<number>(8);
  const [subject, setSubject] = useState<Subject>("mathematics");
  const [chapter, setChapter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [textbooks, setTextbooks] = useState<TextbookEntry[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [tab, setTab] = useState<"upload" | "manage">("manage");

  const loadTextbooks = useCallback(async () => {
    if (!user) return;
    try {
      const res = await adminApi.listTextbooks(user.firebaseToken);
      setTextbooks(res.textbooks);
    } catch {
      // silent — list is best-effort
    } finally {
      setLoadingBooks(false);
    }
  }, [user]);

  useEffect(() => { loadTextbooks(); }, [loadTextbooks]);

  // Poll for processing status
  useEffect(() => {
    const hasProcessing = textbooks.some(t => t.status === "processing");
    if (!hasProcessing) return;
    const interval = setInterval(loadTextbooks, 5000);
    return () => clearInterval(interval);
  }, [textbooks, loadTextbooks]);

  async function handleUpload() {
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    setUploadResult(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("class_num", String(classNum));
    fd.append("subject", subject);
    fd.append("chapter", chapter.trim());
    try {
      const res = await adminApi.uploadPdf(fd, user.firebaseToken);
      setUploadResult(res.message);
      setFile(null);
      setChapter("");
      if (fileRef.current) fileRef.current.value = "";
      loadTextbooks();
      setTab("manage");
    } catch (e: unknown) {
      if (e instanceof ApiError) setError(e.message);
      else setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(textbookId: string) {
    if (!user) return;
    setDeleting(textbookId);
    try {
      await adminApi.deleteTextbook(textbookId, user.firebaseToken);
      setTextbooks(prev => prev.filter(t => t.textbook_id !== textbookId));
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Delete failed.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="min-h-screen bg-rusty-sand flex flex-col">
      <header className="bg-rusty-terracotta text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} aria-label="Back"
          className="text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-white
                     rounded min-w-[44px] min-h-[44px] flex items-center justify-center -ml-1">
          ←
        </button>
        <p className="font-semibold text-sm">Textbook Management</p>
      </header>

      {/* Tab switcher */}
      <div className="flex border-b border-rusty-border bg-rusty-cream">
        <button
          onClick={() => setTab("manage")}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors
            ${tab === "manage" ? "text-rusty-terracotta border-b-2 border-rusty-terracotta" : "text-rusty-muted"}`}
        >
          Uploaded ({textbooks.filter(t => t.status === "ready").length})
        </button>
        <button
          onClick={() => setTab("upload")}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors
            ${tab === "upload" ? "text-rusty-terracotta border-b-2 border-rusty-terracotta" : "text-rusty-muted"}`}
        >
          Upload New
        </button>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">
        {uploadResult && (
          <div className="bg-rusty-success-soft border border-rusty-success/20 rounded-xl px-3 py-2 text-sm text-rusty-success-dark">
            {uploadResult}
          </div>
        )}

        {error && (
          <div className="bg-rusty-danger-soft border border-rusty-danger rounded-xl px-3 py-2 text-sm text-rusty-danger-dark">
            {error}
          </div>
        )}

        {tab === "manage" && (
          <>
            {loadingBooks ? (
              <div className="text-center py-10 text-rusty-muted text-sm">Loading textbooks…</div>
            ) : textbooks.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <p className="text-3xl">📚</p>
                <p className="text-rusty-ink font-semibold">No textbooks uploaded yet</p>
                <p className="text-rusty-muted text-sm">Upload Bihar Board PDFs so students can ask Rusty questions.</p>
                <button onClick={() => setTab("upload")}
                  className="mt-2 px-6 py-2.5 bg-rusty-terracotta text-white text-sm font-semibold rounded-xl min-h-[44px]">
                  Upload First Textbook
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {textbooks.map(book => (
                  <TextbookCard
                    key={book.textbook_id}
                    book={book}
                    onDelete={handleDelete}
                    deleting={deleting}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "upload" && (
          <div className="space-y-5">
            {/* File picker */}
            <div>
              <p className="text-sm font-medium text-rusty-ink mb-2">PDF File</p>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button onClick={() => fileRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-2xl p-8 text-center transition-colors
                  focus:outline-none focus:ring-2 focus:ring-rusty-terracotta
                  ${file ? "border-rusty-green bg-rusty-green-soft" : "border-rusty-border bg-rusty-cream hover:border-rusty-terracotta"}`}>
                {file ? (
                  <div>
                    <p className="text-2xl mb-2">📄</p>
                    <p className="text-sm font-semibold text-rusty-green-dark">{file.name}</p>
                    <p className="text-xs text-rusty-muted mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB · Tap to change</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl mb-2">📁</p>
                    <p className="text-sm text-rusty-ink font-medium">Tap to select PDF</p>
                    <p className="text-xs text-rusty-muted mt-1">Bihar Board textbook only · Max 50 MB</p>
                  </div>
                )}
              </button>
            </div>

            {/* Class */}
            <div>
              <p className="text-sm font-medium text-rusty-ink mb-2">Class</p>
              <div className="flex flex-wrap gap-2">
                {[5, 6, 7, 8, 9, 10].map((c) => (
                  <button key={c} onClick={() => setClassNum(c)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium min-h-[44px] min-w-[48px]
                      focus:outline-none focus:ring-2 focus:ring-rusty-terracotta focus:ring-offset-2 transition-colors
                      ${classNum === c ? "bg-rusty-terracotta text-white border-rusty-terracotta" : "bg-rusty-cream border-rusty-border text-rusty-ink"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <p className="text-sm font-medium text-rusty-ink mb-2">Subject</p>
              <div className="grid grid-cols-2 gap-2">
                {SUBJECTS.map((s) => (
                  <button key={s.value} onClick={() => setSubject(s.value)}
                    className={`px-3 py-3 rounded-xl border text-sm text-left transition-colors min-h-[48px]
                      focus:outline-none focus:ring-2 focus:ring-rusty-terracotta focus:ring-offset-2
                      ${subject === s.value ? "bg-rusty-terracotta text-white border-rusty-terracotta font-semibold" : "bg-rusty-cream border-rusty-border text-rusty-ink"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chapter */}
            <div>
              <p className="text-sm font-medium text-rusty-ink mb-2">Chapter Name <span className="text-rusty-muted font-normal">(optional)</span></p>
              <input
                type="text"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="e.g. Squares and Square Roots"
                maxLength={150}
                className="w-full px-3 py-3 border border-rusty-border rounded-xl text-rusty-ink bg-rusty-cream
                           placeholder:text-rusty-muted focus:outline-none focus:ring-2 focus:ring-rusty-terracotta
                           focus:border-rusty-terracotta text-sm"
              />
              <p className="text-xs text-rusty-muted mt-1">
                Used for source attribution. If the PDF covers one chapter, enter its name.
              </p>
            </div>

            {uploading && (
              <div className="bg-rusty-ai-soft border border-rusty-ai/20 rounded-xl p-4 text-center">
                <div className="text-2xl mb-2 animate-pulse">⚙️</div>
                <p className="text-sm text-rusty-ai font-medium">Uploading PDF…</p>
                <p className="text-xs text-rusty-muted mt-1">Ingestion will continue in the background. You can leave this page.</p>
              </div>
            )}

            {!uploading && (
              <button onClick={handleUpload} disabled={!file}
                className="w-full py-3.5 bg-rusty-terracotta text-white font-semibold rounded-xl
                           hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-rusty-terracotta
                           focus:ring-offset-2 disabled:opacity-40 transition-opacity text-sm min-h-[52px]">
                Upload & Start Ingestion
              </button>
            )}

            <div className="bg-rusty-warning-soft border border-rusty-warning/20 rounded-xl px-3 py-2.5 space-y-1">
              <p className="text-xs text-rusty-warning-dark font-medium">
                Only Bihar Board PDFs may be uploaded.
              </p>
              <p className="text-xs text-rusty-warning-dark">
                To update a chapter (new topics added), delete the old file first, then upload the new version.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
