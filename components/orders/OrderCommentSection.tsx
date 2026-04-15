"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  X,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Play,
  Download,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getOrderComments,
  addOrderComment,
  deleteOrderComment,
  uploadCommentAttachment,
  deleteCommentAttachment,
} from "@/app/actions/comments"

// ── Types ─────────────────────────────────────────────────────────

interface Attachment {
  id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number | null
  storage_path: string | null
  created_at: string
}

interface Comment {
  id: string
  order_id: string
  content: string
  created_at: string
  profiles: { id: string; full_name: string | null; email: string } | null
  order_comment_attachments: Attachment[]
}

interface PendingFile {
  id: string          // local temp id
  file: File
  preview: string | null  // object-URL for image/video/audio
}

// ── Helpers ───────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data-URL prefix ("data:...;base64,")
      resolve(result.split(",")[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return <ImageIcon className="w-4 h-4" />
  if (fileType.startsWith("video/")) return <Video className="w-4 h-4" />
  if (fileType.startsWith("audio/")) return <Music className="w-4 h-4" />
  return <FileText className="w-4 h-4" />
}

function isMediaType(fileType: string): "image" | "video" | "audio" | null {
  if (fileType.startsWith("image/")) return "image"
  if (fileType.startsWith("video/")) return "video"
  if (fileType.startsWith("audio/")) return "audio"
  return null
}

const ACCEPTED = "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
const MAX_FILE_SIZE = 50 * 1024 * 1024
const ACCEPTED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "txt",
])

// ── Attachment preview card ───────────────────────────────────────

function AttachmentCard({
  attachment,
  onDelete,
}: {
  attachment: Attachment
  onDelete?: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const media = isMediaType(attachment.file_type)

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    await onDelete(attachment.id)
    setDeleting(false)
  }

  return (
    <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
      {/* Media previews */}
      {media === "image" && (
        <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.file_url}
            alt={attachment.file_name}
            className="w-full max-h-48 object-cover"
          />
        </a>
      )}
      {media === "video" && (
        <video
          src={attachment.file_url}
          controls
          className="w-full max-h-48 bg-black"
          preload="metadata"
        />
      )}
      {media === "audio" && (
        <div className="p-3">
          <audio src={attachment.file_url} controls className="w-full" />
        </div>
      )}

      {/* Non-media file row */}
      {!media && (
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span className="text-slate-400">{getFileIcon(attachment.file_type)}</span>
          <span className="text-xs text-slate-700 truncate flex-1">{attachment.file_name}</span>
          <a
            href={attachment.file_url}
            target="_blank"
            rel="noopener noreferrer"
            download={attachment.file_name}
            className="text-orange-500 hover:text-orange-600"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* File meta row (under media) */}
      {media && (
        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-500 bg-white border-t border-slate-100">
          <span className="truncate max-w-[70%]">{attachment.file_name}</span>
          <span>{formatBytes(attachment.file_size)}</span>
        </div>
      )}

      {/* Delete button overlay */}
      {onDelete && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
        >
          {deleting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <X className="w-3 h-3" />
          )}
        </button>
      )}
    </div>
  )
}

// ── Pending file thumbnail (before upload) ────────────────────────

function PendingFileCard({
  pf,
  onRemove,
}: {
  pf: PendingFile
  onRemove: (id: string) => void
}) {
  const media = isMediaType(pf.file.type)

  return (
    <div className="relative group rounded-xl overflow-hidden border-2 border-dashed border-orange-200 bg-orange-50">
      {media === "image" && pf.preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pf.preview} alt={pf.file.name} className="w-full max-h-32 object-cover" />
      )}
      {media === "video" && pf.preview && (
        <video src={pf.preview} className="w-full max-h-32 bg-black object-cover" preload="metadata" />
      )}
      {media === "audio" && (
        <div className="flex items-center justify-center h-16">
          <Music className="w-6 h-6 text-orange-400" />
        </div>
      )}
      {!media && (
        <div className="flex items-center justify-center h-16">
          {getFileIcon(pf.file.type)}
        </div>
      )}

      {/* Meta */}
      <div className="px-2 py-1.5 bg-white border-t border-orange-100 text-[11px] text-slate-500 truncate">
        {pf.file.name}
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(pf.id)}
        className="absolute top-1.5 right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-black/50 text-white hover:bg-red-600 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

// ── Comment bubble ────────────────────────────────────────────────

function CommentBubble({
  comment,
  onDelete,
  onAttachmentDelete,
}: {
  comment: Comment
  onDelete: (id: string) => void
  onAttachmentDelete: (attachmentId: string, commentId: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const authorName = comment.profiles?.full_name || comment.profiles?.email || "Unknown"

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete(comment.id)
    setDeleting(false)
  }

  const handleAttachDelete = async (attachmentId: string) => {
    await onAttachmentDelete(attachmentId, comment.id)
  }

  const hasAttachments = comment.order_comment_attachments?.length > 0

  return (
    <div className="group flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-xs shrink-0">
            {authorName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-slate-800">{authorName}</span>
          <span className="text-xs text-slate-400">{formatTime(comment.created_at)}</span>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </button>
      </div>

      {/* Body */}
      <div className="ml-9 space-y-3">
        {comment.content && (
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            {comment.content}
          </p>
        )}

        {/* Attachments grid */}
        {hasAttachments && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {comment.order_comment_attachments.map((att) => (
              <AttachmentCard
                key={att.id}
                attachment={att}
                onDelete={handleAttachDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export function OrderCommentSection({
  orderId,
  onCountChange,
}: {
  orderId: string
  onCountChange?: (count: number) => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const dragCounter = useRef(0)
  const [dragging, setDragging] = useState(false)

  const loadComments = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    const result = await getOrderComments(orderId)
    if (result.success && result.data) {
      setComments(result.data as unknown as Comment[])
    } else {
      setLoadError(result.error || "Failed to load comments")
    }
    setLoading(false)
  }, [orderId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  // Notify parent whenever the comment count changes
  useEffect(() => {
    if (!loading) onCountChange?.(comments.length)
  }, [comments.length, loading, onCountChange])

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [comments.length, loading])

  // Create object-URL previews for pending files
  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setError(null)

    const accepted: File[] = []
    const rejectedTooLarge: string[] = []
    const rejectedType: string[] = []

    for (const file of arr) {
      const ext = file.name.includes(".")
        ? file.name.split(".").pop()?.toLowerCase() ?? ""
        : ""
      const isMimeAccepted =
        file.type.startsWith("image/") ||
        file.type.startsWith("video/") ||
        file.type.startsWith("audio/")
      const isExtAccepted = ACCEPTED_EXTENSIONS.has(ext)

      if (!(isMimeAccepted || isExtAccepted)) {
        rejectedType.push(file.name)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        rejectedTooLarge.push(file.name)
        continue
      }
      accepted.push(file)
    }

    if (rejectedType.length > 0) {
      setError(`Unsupported file type: ${rejectedType.slice(0, 2).join(", ")}${rejectedType.length > 2 ? "..." : ""}`)
    } else if (rejectedTooLarge.length > 0) {
      setError(`File too large (max 50 MB): ${rejectedTooLarge.slice(0, 2).join(", ")}${rejectedTooLarge.length > 2 ? "..." : ""}`)
    }

    if (accepted.length === 0) return

    const news: PendingFile[] = accepted.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      preview: f.type.startsWith("image/") || f.type.startsWith("video/")
        ? URL.createObjectURL(f)
        : null,
    }))
    setPendingFiles((prev) => [...prev, ...news])
  }

  const removePending = (id: string) => {
    setPendingFiles((prev) => {
      const found = prev.find((p) => p.id === id)
      if (found?.preview) URL.revokeObjectURL(found.preview)
      return prev.filter((p) => p.id !== id)
    })
  }

  // Drag-and-drop
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }
  const onDragOver = (e: React.DragEvent) => e.preventDefault()
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
  }

  const handleSubmit = async () => {
    if (!text.trim() && pendingFiles.length === 0) return
    setSubmitting(true)
    setError(null)
    setUploadingStatus(null)

    try {
      // Create the comment (even if text is empty, it acts as an attachment carrier)
      const commentContent = text.trim() || "📎 Attachment"
      const result = await addOrderComment(orderId, commentContent)
      if (!result.success || !result.data) {
        setError(result.error || "Failed to post comment")
        return
      }

      const newComment = result.data as unknown as Comment
      newComment.order_comment_attachments = []
      const failedUploads: string[] = []

      // Upload pending attachments sequentially
      for (const [index, pf] of pendingFiles.entries()) {
        setUploadingStatus(`Uploading attachment ${index + 1}/${pendingFiles.length}...`)
        const b64 = await fileToBase64(pf.file)
        const uploadResult = await uploadCommentAttachment(
          newComment.id,
          orderId,
          b64,
          pf.file.name,
          pf.file.type,
          pf.file.size
        )
        if (uploadResult.success && uploadResult.data) {
          newComment.order_comment_attachments.push(uploadResult.data as Attachment)
        } else {
          failedUploads.push(pf.file.name)
        }
        if (pf.preview) URL.revokeObjectURL(pf.preview)
      }

      setComments((prev) => [...prev, newComment])
      setText("")
      setPendingFiles([])
      if (failedUploads.length > 0) {
        setError(`Comment posted, but ${failedUploads.length} attachment${failedUploads.length !== 1 ? "s" : ""} failed to upload.`)
      }
    } catch (err: any) {
      setError("Something went wrong. Please try again.")
    } finally {
      setUploadingStatus(null)
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    const result = await deleteOrderComment(commentId)
    if (result.success) {
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    }
  }

  const handleAttachmentDelete = async (attachmentId: string, commentId: string) => {
    const result = await deleteCommentAttachment(attachmentId)
    if (result.success) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                order_comment_attachments: c.order_comment_attachments.filter(
                  (a) => a.id !== attachmentId
                ),
              }
            : c
        )
      )
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-orange-500" />
        <h3 className="text-base font-semibold text-slate-800">
          Comments &amp; Attachments
        </h3>
        {!loading && (
          <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
            {comments.length}
          </span>
        )}
      </div>

      {/* Comment list */}
      <div className="space-y-5 min-h-[80px]">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <p className="text-sm text-red-500">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadComments}
              className="h-8 text-xs"
            >
              Retry
            </Button>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
            <MessageSquare className="w-8 h-8 opacity-30" />
            <p className="text-sm">No comments yet. Be the first to add one.</p>
          </div>
        ) : (
          comments.map((c) => (
            <CommentBubble
              key={c.id}
              comment={c}
              onDelete={handleDeleteComment}
              onAttachmentDelete={handleAttachmentDelete}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div
        className={`rounded-2xl border-2 transition-colors ${
          dragging
            ? "border-orange-400 bg-orange-50"
            : "border-slate-200 bg-white"
        }`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* Pending files grid */}
        {pendingFiles.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border-b border-slate-100">
            {pendingFiles.map((pf) => (
              <PendingFileCard key={pf.id} pf={pf} onRemove={removePending} />
            ))}
          </div>
        )}

        {/* Drag overlay hint */}
        {dragging && (
          <div className="flex items-center justify-center py-6 text-orange-500 font-medium text-sm gap-2">
            <Paperclip className="w-4 h-4" />
            Drop files to attach
          </div>
        )}

        {/* Text area */}
        {!dragging && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit()
            }}
            placeholder="Write a comment… (Ctrl+Enter to send)"
            rows={3}
            className="w-full resize-none px-4 pt-3 pb-2 text-sm text-slate-700 placeholder-slate-400 bg-transparent focus:outline-none"
          />
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" />
              Attach
            </button>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Image · Video · Audio · Docs
            </span>
          </div>

          <div className="flex items-center gap-2">
            {error && <p className="text-xs text-red-500">{error}</p>}
            {uploadingStatus && !error && (
              <p className="text-xs text-slate-500">{uploadingStatus}</p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={submitting || (!text.trim() && pendingFiles.length === 0)}
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 text-xs"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {submitting ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 -mt-3">
        Drag &amp; drop files into the box, or click &quot;Attach&quot;. Supports images, videos, audio and documents up to 50 MB.
      </p>
    </div>
  )
}
