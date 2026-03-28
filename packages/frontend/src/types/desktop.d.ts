export {}

declare global {
  interface Window {
    omlDesktop?: {
      apiBase?: string
      pickOpenOmlPath?: () => Promise<string | null>
      pickSaveOmlPath?: (suggestedName: string) => Promise<string | null>
      readFileBase64?: (filePath: string) => Promise<string>
      writeFileBase64?: (filePath: string, base64Data: string) => Promise<boolean>
    }
  }
}
