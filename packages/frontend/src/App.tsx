import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './components/Canvas'
import { Toast } from './components/Toast'
import { useSettingsStore } from './stores/settingsStore'
import { updateLLMConfig } from './services/api'

function LLMSettingsSync() {
  const { llmSettings } = useSettingsStore()

  useEffect(() => {
    updateLLMConfig(llmSettings).catch((error) => {
      console.error('同步 LLM 配置失败:', error)
    })
  }, [llmSettings])

  return null
}

export default function App() {
  return (
    <ReactFlowProvider>
      <LLMSettingsSync />
      <Canvas />
      <Toast />
    </ReactFlowProvider>
  )
}
