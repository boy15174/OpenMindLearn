import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './components/Canvas'
import { Toast } from './components/Toast'

export default function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
      <Toast />
    </ReactFlowProvider>
  )
}
