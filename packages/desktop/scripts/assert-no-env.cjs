const fs = require('fs')
const path = require('path')

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(absolutePath, files)
    } else {
      files.push(absolutePath)
    }
  }
  return files
}

module.exports = async function assertNoEnv(context) {
  const allFiles = walk(context.appOutDir)
  const leakedEnvFiles = allFiles.filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/')
    const fileName = normalized.split('/').pop() || ''
    return fileName === '.env' || fileName.startsWith('.env.')
  })

  if (leakedEnvFiles.length > 0) {
    throw new Error(
      `Build blocked: found forbidden .env files in packaged app:\n${leakedEnvFiles.join('\n')}`
    )
  }
}
