import { useToastStore } from '../stores/toastStore'
import { CheckCircle2, XCircle, X } from 'lucide-react'

export function Toast() {
  const { message, type, visible, hideToast } = useToastStore()

  if (!visible) return null

  return (
    <div className="fixed top-4 right-4 z-[10001] animate-in slide-in-from-top-2">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${
        type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}>
        {type === 'success' ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
          <XCircle className="w-5 h-5 text-red-600" />
        )}
        <span className={`text-sm font-medium ${
          type === 'success' ? 'text-green-900' : 'text-red-900'
        }`}>{message}</span>
        <button onClick={hideToast} className="ml-2 p-0.5 hover:bg-black/5 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
