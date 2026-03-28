const { contextBridge, ipcRenderer } = require('electron')

function getArgument(prefix) {
  const match = process.argv.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : undefined
}

const apiBase = getArgument('--oml-api-base=')

contextBridge.exposeInMainWorld('omlDesktop', {
  apiBase,
  pickOpenOmlPath: () => ipcRenderer.invoke('oml:pick-open-path'),
  pickSaveOmlPath: (suggestedName) => ipcRenderer.invoke('oml:pick-save-path', suggestedName),
  readFileBase64: (filePath) => ipcRenderer.invoke('oml:read-base64', filePath),
  writeFileBase64: (filePath, base64Data) => ipcRenderer.invoke('oml:write-base64', filePath, base64Data)
})
