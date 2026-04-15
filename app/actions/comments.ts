"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { reportError } from "@/lib/monitoring"

// ============================================
// Order Comments Actions
// ============================================

export async function getOrderComments(orderId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("order_comments")
    .select(`
      id,
      order_id,
      content,
      created_at,
      updated_at,
      profiles (
        id,
        full_name,
        email
      ),
      order_comment_attachments (
        id,
        file_name,
        file_url,
        file_type,
        file_size,
        storage_path,
        created_at
      )
    `)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })

  if (error) {
    return { success: false, error: error.message, data: null }
  }

  return { success: true, data: data || [], error: null }
}

export async function addOrderComment(orderId: string, content: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "User not authenticated", data: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  if (!profile) return { success: false, error: "User profile not found", data: null }

  const trimmed = content.trim()
  if (!trimmed) return { success: false, error: "Comment cannot be empty", data: null }
  if (trimmed.length > 5000) return { success: false, error: "Comment too long (max 5000 characters)", data: null }

  const { data, error } = await supabase
    .from("order_comments")
    .insert({
      order_id: orderId,
      content: trimmed,
      created_by: profile.id,
    })
    .select(`
      id,
      order_id,
      content,
      created_at,
      profiles (
        id,
        full_name,
        email
      ),
      order_comment_attachments (
        id,
        file_name,
        file_url,
        file_type,
        file_size,
        storage_path,
        created_at
      )
    `)
    .single()

  if (error) {
    reportError(error, { area: "comments.addOrderComment", orderId })
    return { success: false, error: error.message, data: null }
  }

  revalidatePath(`/dashboard/orders/${orderId}`)
  return { success: true, data, error: null }
}

export async function deleteOrderComment(commentId: string) {
  const supabase = await createClient()

  // Fetch attachments first so we can clean up storage
  const { data: attachments } = await supabase
    .from("order_comment_attachments")
    .select("storage_path")
    .eq("comment_id", commentId)

  const { data: comment, error: fetchErr } = await supabase
    .from("order_comments")
    .select("order_id")
    .eq("id", commentId)
    .single()

  if (fetchErr || !comment) {
    return { success: false, error: fetchErr?.message || "Comment not found" }
  }

  // Remove storage files
  if (attachments && attachments.length > 0) {
    const paths = attachments
      .map((a) => a.storage_path)
      .filter(Boolean) as string[]
    if (paths.length > 0) {
      await supabase.storage.from("order-comment-attachments").remove(paths)
    }
  }

  const { error } = await supabase
    .from("order_comments")
    .delete()
    .eq("id", commentId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/orders/${comment.order_id}`)
  return { success: true }
}

export async function uploadCommentAttachment(
  commentId: string,
  orderId: string,
  fileBase64: string,
  fileName: string,
  fileType: string,
  fileSize?: number
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "User not authenticated", data: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single()

  if (!profile) return { success: false, error: "User profile not found", data: null }

  // Validate comment belongs to the given order
  const { data: comment, error: commentErr } = await supabase
    .from("order_comments")
    .select("id, order_id")
    .eq("id", commentId)
    .single()

  if (commentErr || !comment) {
    return { success: false, error: "Comment not found", data: null }
  }
  if (comment.order_id !== orderId) {
    return { success: false, error: "Comment does not belong to this order", data: null }
  }

  // Max 50 MB per file
  const MAX_SIZE = 50 * 1024 * 1024
  if (fileSize && fileSize > MAX_SIZE) {
    return { success: false, error: "File too large (max 50 MB)", data: null }
  }

  const buffer = Buffer.from(fileBase64, "base64")
  const storagePath = `order-comments/${orderId}/${commentId}/${Date.now()}-${fileName}`

  const { error: uploadError } = await supabase.storage
    .from("order-comment-attachments")
    .upload(storagePath, buffer, {
      contentType: fileType || "application/octet-stream",
      upsert: false,
    })

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}`, data: null }
  }

  const { data: urlData } = supabase.storage
    .from("order-comment-attachments")
    .getPublicUrl(storagePath)

  const { data, error } = await supabase
    .from("order_comment_attachments")
    .insert({
      comment_id: commentId,
      order_id: orderId,
      file_name: fileName,
      file_url: urlData.publicUrl,
      file_type: fileType,
      file_size: fileSize ?? buffer.length,
      storage_path: storagePath,
      uploaded_by: profile.id,
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from("order-comment-attachments").remove([storagePath])
    return { success: false, error: error.message, data: null }
  }

  revalidatePath(`/dashboard/orders/${orderId}`)
  return { success: true, data, error: null }
}

export async function deleteCommentAttachment(attachmentId: string) {
  const supabase = await createClient()

  const { data: attachment, error: fetchError } = await supabase
    .from("order_comment_attachments")
    .select("order_id, storage_path")
    .eq("id", attachmentId)
    .single()

  if (fetchError || !attachment) {
    return { success: false, error: fetchError?.message || "Attachment not found" }
  }

  if (attachment.storage_path) {
    await supabase.storage
      .from("order-comment-attachments")
      .remove([attachment.storage_path])
  }

  const { error } = await supabase
    .from("order_comment_attachments")
    .delete()
    .eq("id", attachmentId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/orders/${attachment.order_id}`)
  return { success: true }
}
