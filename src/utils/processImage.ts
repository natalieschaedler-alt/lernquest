import { supabase } from '../lib/supabase'

const MAX_DIM     = 1600   // px — longest side after resize
const JPEG_QUALITY = 0.85  // output quality (keeps file small but readable)

/**
 * Resize an image File to at most MAX_DIM on the longest side and convert to
 * JPEG. Returns the base64-encoded data string (without the data-URL prefix).
 *
 * Note: Canvas operations do not respect EXIF orientation, so the image is
 * sent as-is. Claude can handle typical phone-photo orientations fine.
 */
async function resizeToJpegBase64(file: File): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      let { width, height } = img

      // Downscale while preserving aspect ratio
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) {
          height = Math.round(height * MAX_DIM / width)
          width  = MAX_DIM
        } else {
          width  = Math.round(width * MAX_DIM / height)
          height = MAX_DIM
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Canvas context not available'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(objectUrl)

      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
      // Strip the "data:image/jpeg;base64," prefix
      const base64 = dataUrl.split(',')[1]
      if (!base64) {
        reject(new Error('Canvas produced empty output'))
        return
      }
      resolve({ base64, mimeType: 'image/jpeg' })
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Bild konnte nicht geladen werden'))
    }

    img.src = objectUrl
  })
}

/**
 * Send a photo File to the /api/process-image endpoint and return the
 * extracted text. Handles client-side resizing and auth token injection.
 *
 * @throws {Error} with a human-readable German message on failure.
 */
export async function extractTextFromImage(file: File): Promise<string> {
  // Validate file type before resizing
  if (!file.type.startsWith('image/')) {
    throw new Error('Bitte wähle ein Bild (JPEG, PNG oder WebP).')
  }

  const { base64, mimeType } = await resizeToJpegBase64(file)

  // Inject auth token if the user is signed in
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token

  const response = await fetch('/api/process-image', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ imageBase64: base64, mimeType }),
  })

  let result: { error: string | null; text: string | null }
  try {
    result = await response.json() as { error: string | null; text: string | null }
  } catch {
    throw new Error('Ungültige Server-Antwort')
  }

  if (!response.ok || result.error || !result.text) {
    throw new Error(result.error ?? 'Das Foto konnte nicht verarbeitet werden.')
  }

  return result.text
}
