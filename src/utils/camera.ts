export const startCamera = async (): Promise<MediaStream> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
      },
    })
    return stream
  } catch (error) {
    console.error('Error accessing camera:', error)
    throw error
  }
}

export const capturePhoto = async (videoElement: HTMLVideoElement): Promise<Blob> => {
  if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new Error('Kamera belum siap. Tunggu sebentar lalu ambil foto lagi.')
  }

  if (videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) {
    throw new Error('Foto belum tersedia dari kamera. Pastikan kamera aktif lalu coba lagi.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = videoElement.videoWidth
  canvas.height = videoElement.videoHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.drawImage(videoElement, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) {
          resolve(blob)
        } else {
          reject(new Error('Foto belum tersedia. Ambil ulang foto sebelum mengirim absensi.'))
        }
      },
      'image/jpeg',
      0.95
    )
  })
}

export const stopMediaStream = (stream: MediaStream): void => {
  stream.getTracks().forEach((track) => {
    track.stop()
  })
}

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export const uploadPhoto = async (
  file: Blob,
  attendanceId: string,
  supabase: any
): Promise<string> => {
  const fileName = `${attendanceId}-${Date.now()}.jpg`
  const uploadResult = await withTimeout<{ error: any }>(
    supabase.storage
      .from('attendance-photo')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg',
      }),
    20000,
    'Upload foto terlalu lama. Periksa koneksi internet dan bucket attendance-photo.'
  )

  if (uploadResult.error) {
    throw uploadResult.error
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('attendance-photo').getPublicUrl(fileName)

  return publicUrl
}

export const getIPAddress = async (): Promise<string> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3000)

  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    })

    if (!response.ok) {
      return 'unavailable'
    }

    const data = await response.json()
    return typeof data.ip === 'string' && data.ip.trim().length > 0 ? data.ip : 'unavailable'
  } catch (error) {
    console.error('Error getting IP address:', error)
    return 'unavailable'
  } finally {
    clearTimeout(timeoutId)
  }
}

export const getUserAgent = (): string => {
  return navigator.userAgent
}
