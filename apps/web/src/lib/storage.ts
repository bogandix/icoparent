import { fitWithin } from "./images"
import { rpc } from "./rpc"
import { supabase } from "./supabase"

type Owner = {
  familyId: string
  ownerType: "expense" | "post" | "event" | "proposal" | "checkin"
  ownerId: string
}

async function canvasBlob(file: File, maxEdge: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const size = fitWithin(bitmap.width, bitmap.height, maxEdge)
  const canvas = document.createElement("canvas")
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("image_failed")
  context.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality)
  })
  if (!blob) throw new Error("image_failed")
  return blob
}

export async function uploadImage(file: File, owner: Owner): Promise<void> {
  const full = await canvasBlob(file, 1600, 0.75)
  const thumb = await canvasBlob(file, 400, 0.7)
  const id = crypto.randomUUID()
  const path = `family/${owner.familyId}/${owner.ownerType}/${owner.ownerId}/${id}.webp`
  const thumbPath = `family/${owner.familyId}/${owner.ownerType}/${owner.ownerId}/${id}-thumb.webp`
  const fullResult = await supabase.storage.from("family-media").upload(path, full, {
    contentType: "image/webp",
    upsert: false,
  })
  if (fullResult.error) throw fullResult.error
  const thumbResult = await supabase.storage.from("family-media").upload(thumbPath, thumb, {
    contentType: "image/webp",
    upsert: false,
  })
  if (thumbResult.error) throw thumbResult.error
  await rpc("create_attachment", {
    p_family_id: owner.familyId,
    p_owner_type: owner.ownerType,
    p_owner_id: owner.ownerId,
    p_kind: "image",
    p_storage_path: path,
    p_thumb_path: thumbPath,
    p_mime: "image/webp",
    p_bytes: full.size,
    p_width: null,
    p_height: null,
    p_duration_ms: null,
  })
}

export async function uploadAudio(blob: Blob, durationMs: number, owner: Owner): Promise<void> {
  if (durationMs > 120_000) throw new Error("audio_too_long")
  const id = crypto.randomUUID()
  const extension = blob.type.includes("mp4") ? "m4a" : "webm"
  const path = `family/${owner.familyId}/${owner.ownerType}/${owner.ownerId}/${id}.${extension}`
  const uploaded = await supabase.storage.from("family-media").upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  })
  if (uploaded.error) throw uploaded.error
  await rpc("create_attachment", {
    p_family_id: owner.familyId,
    p_owner_type: owner.ownerType,
    p_owner_id: owner.ownerId,
    p_kind: "audio",
    p_storage_path: path,
    p_thumb_path: null,
    p_mime: blob.type,
    p_bytes: blob.size,
    p_width: null,
    p_height: null,
    p_duration_ms: durationMs,
  })
}

export async function signedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("family-media").createSignedUrl(path, 60 * 60)
  if (error) return null
  return data.signedUrl
}
