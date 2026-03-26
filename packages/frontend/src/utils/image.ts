import type { NodeImage } from '../types'

function generateImageId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function readFileAsNodeImage(file: File, name?: string): Promise<NodeImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      const mimeType = dataUrl.split(':')[1].split(';')[0]
      resolve({
        id: generateImageId(),
        base64,
        mimeType,
        name: name ?? file.name
      })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function readFilesAsNodeImages(files: File[]): Promise<NodeImage[]> {
  return Promise.all(files.map((file) => readFileAsNodeImage(file)))
}

export function readClipboardImages(clipboardItems: DataTransferItemList): Promise<NodeImage[]> {
  const imageItems = Array.from(clipboardItems).filter((item) => item.type.startsWith('image/'))
  if (imageItems.length === 0) return Promise.resolve([])

  return Promise.all(
    imageItems.map((item) => {
      const file = item.getAsFile()
      if (!file) return null
      const ext = file.type.split('/')[1] || 'png'
      return readFileAsNodeImage(file, `pasted-${Date.now()}.${ext}`)
    })
  ).then((results) => results.filter((img): img is NodeImage => img !== null))
}
