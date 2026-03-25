import { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { ReactFlow, Background, Controls, BackgroundVariant } from '@xyflow/react'
import type { Node as RFNode, Viewport } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NodeCard } from './NodeCard'
import { Toolbar } from './Toolbar'
import { MenuItem } from './MenuItem'
import { generateNode } from '../services/api'
import { useToastStore } from '../stores/toastStore'
import { useSettingsStore } from '../stores/settingsStore'
import { Plus, X, Eye, Pencil, RefreshCw, ClipboardPaste, Sparkles, Download, Tags, History, Search, Layers, Trash2 } from 'lucide-react'
import { cn } from '../utils/cn'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CanvasMode, MetaEditorState, VersionDialogState, DetailPanelState } from '../types/canvas'
import { buildDiffLines } from '../utils/search'

import { useCanvasContextMenu } from '../hooks/useCanvasContextMenu'
import { useCanvasSearch } from '../hooks/useCanvasSearch'
import { useCanvasRegions } from '../hooks/useCanvasRegions'
import { useCanvasNodes } from '../hooks/useCanvasNodes'
import { useCanvasFileIO } from '../hooks/useCanvasFileIO'

const nodeTypes = { custom: NodeCard }

export function Canvas() {
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('learn')
  const [detailPanel, setDetailPanel] = useState<DetailPanelState | null>(null)
  const [detailFontSize, setDetailFontSize] = useState(15)
  const [initialInput, setInitialInput] = useState('')
  const [initialGenerating, setInitialGenerating] = useState(false)
  const [metaEditor, setMetaEditor] = useState<MetaEditorState | null>(null)
  const [versionDialog, setVersionDialog] = useState<VersionDialogState | null>(null)
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const canvasRef = useRef<HTMLDivElement>(null)

  const theme = useSettingsStore((state) => state.uiSettings.theme)
  const { showToast } = useToastStore()

  // --- Hook 4: Nodes (must come before regions since regions needs nodes) ---
  // We pass a placeholder regions initially; the dirty-flag effect inside
  // useCanvasNodes depends on `regions` which we get from useCanvasRegions.
  // However, useCanvasRegions needs `nodes` and `setNodes` from useCanvasNodes.
  // To break the cycle, useCanvasNodes takes regions as a parameter and we
  // wire it up after useCanvasRegions via a ref-based approach.
  // Actually, looking at the original code, the dirty flag effect depends on
  // [nodes, edges, regions, setDirty]. We need regions from useCanvasRegions.
  // But useCanvasRegions needs nodes/setNodes from useCanvasNodes.
  // Solution: useCanvasNodes takes regions as param. We'll use a state-level
  // indirection: useCanvasNodes creates nodes first, then useCanvasRegions
  // uses those nodes, and we pass regions back into useCanvasNodes.
  // Since hooks can't be called conditionally, we use a ref to hold regions.
  const regionsRef = useRef<any[]>([])

  const {
    nodes, setNodes, onNodesChange,
    edges, setEdges, onEdgesChange,
    skipDirtyFlagRef,
    refreshNodeRuntimeData,
    getCanvasCenterFlowPosition,
    handleSaveNodeContent,
    handleGenerate,
    handleExpand,
    createFirstNode,
    createNode,
    triggerNodeEdit,
    handleSaveNodeMeta: handleSaveNodeMetaRaw,
    handleRestoreVersion: handleRestoreVersionRaw,
    handleExportNode
  } = useCanvasNodes(canvasRef, regionsRef.current)

  // --- Derived: selectedNodeIds (needed by useCanvasRegions) ---
  const selectedNodeIds = useMemo(() => {
    return nodes.filter((node) => node.selected).map((node) => node.id)
  }, [nodes])

  // --- Hook 3: Regions ---
  const {
    regions, setRegions,
    regionDrag, setRegionDrag,
    regionTitleEdit, setRegionTitleEdit,
    showRegionPanel, setShowRegionPanel,
    newRegionName, setNewRegionName,
    newRegionColor, setNewRegionColor,
    newRegionDescription, setNewRegionDescription,
    manualRegionNodeIds, setManualRegionNodeIds,
    regionBoxes, regionCoveredNodeCount,
    handleCreateRegion, handleUpdateRegion, handleDeleteRegion,
    startRegionTitleEdit, commitRegionTitleEdit,
    handleStartRegionDrag, handleStartRegionResize
  } = useCanvasRegions(nodes, setNodes, canvasMode, selectedNodeIds, getCanvasCenterFlowPosition)

  // Keep regionsRef in sync so dirty-flag effect in useCanvasNodes sees current regions
  regionsRef.current = regions

  // --- Hook 1: Context Menu ---
  const {
    contextMenu, setContextMenu,
    handlePaneContextMenu, handleNodeContextMenu
  } = useCanvasContextMenu(canvasMode)

  // --- Hook 2: Search ---
  const {
    searchQuery, setSearchQuery,
    activeSearchIndex,
    searchResults,
    highlightedNodeSet,
    activeSearchNodeId,
    matchedPreview,
    focusSearchResult,
    resetSearch
  } = useCanvasSearch(nodes, viewport)

  // --- Hook 5: File IO ---
  const { handleSave, handleLoad, handleNew } = useCanvasFileIO({
    nodes,
    edges,
    regions,
    setNodes,
    setEdges,
    setRegions,
    skipDirtyFlagRef,
    refreshNodeRuntimeData,
    handleGenerate,
    handleSaveNodeContent,
    handleExpand,
    resetSearch,
    setDetailPanel,
    setMetaEditor,
    setVersionDialog,
    setShowRegionPanel,
    setInitialInput,
    setInitialGenerating
  })

  // --- Derived computations ---
  const renderedNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        mode: canvasMode,
        searchMatched: highlightedNodeSet.has(node.id),
        searchActive: activeSearchNodeId === node.id
      }
    }))
  }, [nodes, highlightedNodeSet, activeSearchNodeId, canvasMode])

  const selectedDiffLines = useMemo(() => {
    if (!versionDialog) return []
    const version = versionDialog.versions[selectedVersionIndex]
    if (!version) return []
    return buildDiffLines(version.content, versionDialog.currentContent)
  }, [selectedVersionIndex, versionDialog])

  // --- Mode-change effect ---
  useEffect(() => {
    setContextMenu(null)
    setRegionDrag(null)
    setRegionTitleEdit(null)
    if (canvasMode === 'view') {
      setNodes((nds) =>
        nds.map((node) =>
          node.data?.isEditing
            ? {
                ...node,
                data: {
                  ...node.data,
                  isEditing: false
                }
              }
            : node
        )
      )
      setShowRegionPanel(false)
      setMetaEditor(null)
      setVersionDialog(null)
    }
  }, [canvasMode, setNodes, setContextMenu, setRegionDrag, setRegionTitleEdit, setShowRegionPanel])

  // --- Thin handlers ---
  const openNodeDetailById = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return
    setDetailPanel({
      nodeId,
      content: String(node.data.content || ''),
      question: String(node.data.question || '')
    })
  }, [nodes])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: RFNode) => {
    if (canvasMode !== 'view') return
    openNodeDetailById(node.id)
  }, [canvasMode, openNodeDetailById])

  const openNodeMetaEditor = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return
    setMetaEditor({
      nodeId,
      tagsText: (node.data.tags || []).join(', '),
      note: node.data.note || ''
    })
  }, [nodes])

  const openVersionDialog = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return
    const versions = node.data.versions || []
    setVersionDialog({
      nodeId,
      versions,
      currentContent: node.data.content || ''
    })
    setSelectedVersionIndex(Math.max(0, versions.length - 1))
  }, [nodes])

  const handleSaveNodeMeta = useCallback(() => {
    if (!metaEditor) return
    handleSaveNodeMetaRaw(metaEditor, () => setMetaEditor(null))
  }, [metaEditor, handleSaveNodeMetaRaw])

  const handleRestoreVersion = useCallback(() => {
    if (!versionDialog) return
    handleRestoreVersionRaw(versionDialog, selectedVersionIndex, () => setVersionDialog(null))
  }, [versionDialog, selectedVersionIndex, handleRestoreVersionRaw])

  const handleCreateFirstFromText = useCallback(() => {
    const text = initialInput.trim()
    if (!text) return
    createFirstNode(text, false, text)
    setInitialInput('')
    showToast('首节点已创建', 'success')
  }, [createFirstNode, initialInput, showToast])

  const handleGenerateFirstFromPrompt = useCallback(async () => {
    const prompt = initialInput.trim()
    if (!prompt) return

    setInitialGenerating(true)
    try {
      const result = await generateNode(prompt)
      createFirstNode(result.content || '', false, prompt)
      setInitialInput('')
      showToast('首节点生成成功', 'success')
    } catch (error) {
      console.error('首节点生成失败:', error)
      showToast('首节点生成失败，请重试', 'error')
    } finally {
      setInitialGenerating(false)
    }
  }, [createFirstNode, initialInput, showToast])

  return (
    <div className="w-screen h-screen flex flex-col bg-background">
      <Toolbar
        onSave={handleSave}
        onLoad={handleLoad}
        onNew={handleNew}
        mode={canvasMode}
        onModeChange={setCanvasMode}
      />

      <div className="flex-1 flex min-h-0">
        <div ref={canvasRef} className={cn('flex-1 transition-all duration-300 relative min-h-0', detailPanel && 'flex-[2]')}>
          <div className="absolute inset-0 z-20">
            <ReactFlow
              nodes={renderedNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onPaneContextMenu={handlePaneContextMenu}
              onNodeContextMenu={handleNodeContextMenu}
              onNodeClick={handleNodeClick}
              onMove={(_, nextViewport) => setViewport(nextViewport)}
              nodesDraggable={canvasMode === 'learn'}
              nodesConnectable={false}
              nodesFocusable={canvasMode === 'learn'}
              edgesFocusable={canvasMode === 'learn'}
              elementsSelectable
              deleteKeyCode={canvasMode === 'learn' ? ['Backspace', 'Delete'] : null}
              panOnDrag={!regionDrag}
              colorMode={theme}
              fitView
            >
              <Background gap={16} size={1} color="hsl(var(--canvas-dot))" variant={BackgroundVariant.Dots} />
              <Controls className="!shadow-md !border-border !rounded-lg" />
            </ReactFlow>
          </div>

          <div className="absolute top-3 left-3 z-30 pointer-events-auto flex items-start gap-2">
            <div className="w-[360px] bg-background/95 border border-border rounded-lg shadow-md p-2 backdrop-blur">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      focusSearchResult(activeSearchIndex + 1)
                    }
                  }}
                  className="w-full text-sm outline-none bg-transparent"
                  placeholder="搜索内容 / 标签 / 备注..."
                />
              </div>

              {searchQuery.trim() && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>结果 {searchResults.length === 0 ? 0 : activeSearchIndex + 1} / {searchResults.length}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => focusSearchResult(activeSearchIndex - 1)}
                        disabled={searchResults.length === 0}
                        className="px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40"
                      >
                        上一个
                      </button>
                      <button
                        onClick={() => focusSearchResult(activeSearchIndex + 1)}
                        disabled={searchResults.length === 0}
                        className="px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40"
                      >
                        下一个
                      </button>
                    </div>
                  </div>

                  {matchedPreview && (
                    <div className="text-[11px] leading-relaxed text-muted-foreground border border-border rounded p-2 bg-muted/40 max-h-24 overflow-y-auto">
                      {matchedPreview.highlighted.slice(0, 220)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {canvasMode === 'learn' && (
              <button
                onClick={() => setShowRegionPanel((value) => !value)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background/95 shadow-md text-sm hover:bg-accent backdrop-blur"
              >
                <Layers className="w-4 h-4" />
                区域
              </button>
            )}
          </div>

          {regionBoxes.length > 0 && (
            <>
              <div className="absolute inset-0 z-[5] pointer-events-none">
                {regionBoxes.map((box) => (
                  <div
                    key={`fill-${box.id}`}
                    className={cn(
                      'absolute rounded-md',
                      regionDrag?.regionId === box.id && 'ring-1 ring-primary/40'
                    )}
                    style={{
                      left: box.x * viewport.zoom + viewport.x,
                      top: box.y * viewport.zoom + viewport.y,
                      width: box.width * viewport.zoom,
                      height: box.height * viewport.zoom,
                      border: `1.5px dashed ${box.color}`,
                      backgroundColor: `${box.color}12`
                    }}
                  >
                    {regionTitleEdit?.regionId !== box.id && (
                      <div
                        className="absolute -top-6 left-1 max-w-[240px] h-5 px-2 inline-flex items-center gap-2 text-[11px] text-white rounded-md shadow-sm pointer-events-none select-none"
                        style={{
                          backgroundColor: `${box.color}d9`,
                          border: `1px solid ${box.color}`
                        }}
                      >
                        <span className="truncate">{box.name}</span>
                        <span className="opacity-85 shrink-0">({regionCoveredNodeCount.get(box.id) || 0})</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {canvasMode === 'learn' && (
                <div className="absolute inset-0 z-30 pointer-events-none">
                  {regionBoxes.map((box) => (
                    <div
                      key={`interaction-${box.id}`}
                      className="absolute pointer-events-none"
                      style={{
                        left: box.x * viewport.zoom + viewport.x,
                        top: box.y * viewport.zoom + viewport.y,
                        width: box.width * viewport.zoom,
                        height: box.height * viewport.zoom
                      }}
                    >
                      <div
                        className={cn(
                          'absolute -top-6 left-1 max-w-[240px] h-5 px-2 inline-flex items-center gap-2 text-[11px] pointer-events-auto select-none rounded-md',
                          regionTitleEdit?.regionId === box.id ? 'cursor-text' : 'cursor-move'
                        )}
                        onMouseDown={(event) => {
                          if (regionTitleEdit?.regionId === box.id) return
                          handleStartRegionDrag(event, box)
                        }}
                        onDoubleClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          startRegionTitleEdit(box.id, box.name)
                        }}
                        style={{ backgroundColor: 'transparent', border: '1px solid transparent' }}
                      >
                        {regionTitleEdit?.regionId === box.id ? (
                          <input
                            autoFocus
                            value={regionTitleEdit.draft}
                            onChange={(event) =>
                              setRegionTitleEdit((prev) =>
                                prev
                                  ? { ...prev, draft: event.target.value }
                                  : prev
                              )
                            }
                            onMouseDown={(event) => event.stopPropagation()}
                            onDoubleClick={(event) => event.stopPropagation()}
                            onBlur={commitRegionTitleEdit}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                commitRegionTitleEdit()
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault()
                                setRegionTitleEdit(null)
                              }
                            }}
                            className="flex-1 h-4 px-1 rounded-sm bg-background/95 border border-border/70 text-[11px] text-foreground outline-none"
                          />
                        ) : (
                          <span className="truncate opacity-0">{box.name}</span>
                        )}
                        <span className={cn('shrink-0', regionTitleEdit?.regionId === box.id ? 'opacity-85 text-white' : 'opacity-0')}>
                          ({regionCoveredNodeCount.get(box.id) || 0})
                        </span>
                      </div>

                      <div
                        className="absolute top-0 left-3 right-3 h-4 -translate-y-2 pointer-events-auto cursor-ns-resize"
                        onMouseDown={(event) => handleStartRegionResize(event, box, 'n')}
                      />
                      <div
                        className="absolute bottom-0 left-3 right-3 h-4 translate-y-2 pointer-events-auto cursor-ns-resize"
                        onMouseDown={(event) => handleStartRegionResize(event, box, 's')}
                      />
                      <div
                        className="absolute left-0 top-3 bottom-3 w-4 -translate-x-2 pointer-events-auto cursor-ew-resize"
                        onMouseDown={(event) => handleStartRegionResize(event, box, 'w')}
                      />
                      <div
                        className="absolute right-0 top-3 bottom-3 w-4 translate-x-2 pointer-events-auto cursor-ew-resize"
                        onMouseDown={(event) => handleStartRegionResize(event, box, 'e')}
                      />

                      <div
                        className="absolute -left-2.5 -top-2.5 w-5 h-5 bg-transparent pointer-events-auto cursor-nwse-resize"
                        onMouseDown={(event) => handleStartRegionResize(event, box, 'nw')}
                      />
                      <div
                        className="absolute -right-2.5 -top-2.5 w-5 h-5 bg-transparent pointer-events-auto cursor-nesw-resize"
                        onMouseDown={(event) => handleStartRegionResize(event, box, 'ne')}
                      />
                      <div
                        className="absolute -left-2.5 -bottom-2.5 w-5 h-5 bg-transparent pointer-events-auto cursor-nesw-resize"
                        onMouseDown={(event) => handleStartRegionResize(event, box, 'sw')}
                      />
                      <div
                        className="absolute -right-2.5 -bottom-2.5 w-5 h-5 bg-transparent pointer-events-auto cursor-nwse-resize"
                        onMouseDown={(event) => handleStartRegionResize(event, box, 'se')}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {canvasMode === 'learn' && showRegionPanel && (
            <div className="absolute top-16 right-3 z-40 w-[360px] max-h-[70vh] overflow-y-auto bg-background rounded-xl border border-border shadow-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">区域标注</h3>
                <button
                  onClick={() => setShowRegionPanel(false)}
                  className="p-1 rounded hover:bg-accent"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-2 rounded border border-border bg-muted/30 space-y-2">
                <input
                  value={newRegionName}
                  onChange={(e) => setNewRegionName(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                  placeholder="区域标题"
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">颜色</label>
                  <input
                    type="color"
                    value={newRegionColor}
                    onChange={(e) => setNewRegionColor(e.target.value)}
                    className="w-10 h-8 p-0 border border-border rounded"
                  />
                </div>
                <textarea
                  value={newRegionDescription}
                  onChange={(e) => setNewRegionDescription(e.target.value)}
                  rows={2}
                  className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background resize-none"
                  placeholder="区域说明（可选）"
                />
                <textarea
                  value={manualRegionNodeIds}
                  onChange={(e) => setManualRegionNodeIds(e.target.value)}
                  rows={2}
                  className="w-full px-2 py-1.5 text-xs rounded border border-border bg-background resize-none"
                  placeholder="初始化参考节点 ID（可选，逗号分隔；仅用于创建时计算区域大小）"
                />
                <div className="text-xs text-muted-foreground">
                  当前选中节点：{selectedNodeIds.length}（留空时会以选中节点初始化区域）
                </div>
                <button
                  onClick={handleCreateRegion}
                  className="w-full px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:bg-primary/90"
                >
                  创建区域
                </button>
              </div>

              <div className="space-y-2">
                {regions.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">还没有区域</p>
                )}

                {regions.map((region) => (
                  <div key={region.id} className="p-2 rounded border border-border space-y-2">
                    <input
                      value={region.name}
                      onChange={(e) => handleUpdateRegion(region.id, { name: e.target.value })}
                      className="w-full px-2 py-1 text-sm rounded border border-border"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={region.color || '#22c55e'}
                        onChange={(e) => handleUpdateRegion(region.id, { color: e.target.value })}
                        className="w-10 h-8 p-0 border border-border rounded"
                      />
                      <div className="flex-1 text-xs text-muted-foreground">
                        覆盖节点：{regionCoveredNodeCount.get(region.id) || 0}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={Math.round(region.x)}
                        onChange={(e) => {
                          const value = Number(e.target.value)
                          if (Number.isFinite(value)) handleUpdateRegion(region.id, { x: value })
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-border"
                        placeholder="X"
                      />
                      <input
                        type="number"
                        value={Math.round(region.y)}
                        onChange={(e) => {
                          const value = Number(e.target.value)
                          if (Number.isFinite(value)) handleUpdateRegion(region.id, { y: value })
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-border"
                        placeholder="Y"
                      />
                      <input
                        type="number"
                        value={Math.round(region.width)}
                        onChange={(e) => {
                          const value = Number(e.target.value)
                          if (Number.isFinite(value)) handleUpdateRegion(region.id, { width: value })
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-border"
                        placeholder="宽度"
                      />
                      <input
                        type="number"
                        value={Math.round(region.height)}
                        onChange={(e) => {
                          const value = Number(e.target.value)
                          if (Number.isFinite(value)) handleUpdateRegion(region.id, { height: value })
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-border"
                        placeholder="高度"
                      />
                    </div>
                    <textarea
                      value={region.description || ''}
                      onChange={(e) => handleUpdateRegion(region.id, { description: e.target.value })}
                      rows={2}
                      className="w-full px-2 py-1 text-xs rounded border border-border resize-none"
                      placeholder="区域说明"
                    />
                    <button
                      onClick={() => handleDeleteRegion(region.id)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="w-3 h-3" /> 删除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nodes.length === 0 && canvasMode === 'learn' && (
            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-4">
              <div className="pointer-events-auto w-full max-w-[560px] bg-background/95 border border-border rounded-xl shadow-lg p-4 backdrop-blur">
                <h3 className="text-base font-semibold text-foreground">创建首个知识节点</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  粘贴文本可直接创建首节点，或输入 Prompt 后一键生成。
                </p>
                <textarea
                  value={initialInput}
                  onChange={(e) => setInitialInput(e.target.value)}
                  rows={6}
                  className="mt-3 w-full p-3 text-sm rounded border border-border/70 bg-background resize-none outline-none focus:border-primary/50"
                  placeholder="粘贴文本，或输入你希望生成的主题..."
                />
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={handleCreateFirstFromText}
                    disabled={!initialInput.trim() || initialGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    粘贴文本创建
                  </button>
                  <button
                    onClick={handleGenerateFirstFromPrompt}
                    disabled={!initialInput.trim() || initialGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" />
                    {initialGenerating ? '生成中...' : 'Prompt 生成'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {nodes.length === 0 && canvasMode === 'view' && (
            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-4">
              <div className="pointer-events-auto w-full max-w-[520px] bg-background/95 border border-border rounded-xl shadow-lg p-4 text-center">
                <h3 className="text-base font-semibold text-foreground">查看模式</h3>
                <p className="text-sm text-muted-foreground mt-1">当前画布没有可复习节点。请切换到学习模式后创建内容。</p>
              </div>
            </div>
          )}

          {contextMenu && (
            <div
              data-state="open"
              className="fixed z-[9999] min-w-[220px] rounded-lg border border-border bg-background text-foreground shadow-lg py-1"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.type === 'pane' && (
                <MenuItem
                  icon={<Plus className="w-4 h-4" />}
                  label="创建知识节点"
                  onClick={() => {
                    createNode(contextMenu.flowPosition!)
                    setContextMenu(null)
                  }}
                />
              )}

              {contextMenu.type === 'node' && (
                <>
                  <MenuItem
                    icon={<Eye className="w-4 h-4" />}
                    label="查看详情"
                    onClick={() => {
                      if (contextMenu.nodeId) openNodeDetailById(contextMenu.nodeId)
                      setContextMenu(null)
                    }}
                  />
                  <MenuItem
                    icon={<Pencil className="w-4 h-4" />}
                    label="编辑内容"
                    onClick={() => {
                      triggerNodeEdit(contextMenu.nodeId!)
                      setContextMenu(null)
                    }}
                  />
                  <MenuItem
                    icon={<Tags className="w-4 h-4" />}
                    label="标签与备注"
                    onClick={() => {
                      openNodeMetaEditor(contextMenu.nodeId!)
                      setContextMenu(null)
                    }}
                  />
                  <MenuItem
                    icon={<History className="w-4 h-4" />}
                    label="版本历史"
                    onClick={() => {
                      openVersionDialog(contextMenu.nodeId!)
                      setContextMenu(null)
                    }}
                  />
                  <MenuItem
                    icon={<Download className="w-4 h-4" />}
                    label="导出为 Markdown"
                    onClick={() => {
                      handleExportNode(contextMenu.nodeId!)
                      setContextMenu(null)
                    }}
                  />
                  <div className="h-px bg-border mx-2 my-1" />
                  <MenuItem
                    icon={<RefreshCw className="w-4 h-4" />}
                    label="重新生成"
                    onClick={() => {
                      triggerNodeEdit(contextMenu.nodeId!)
                      setContextMenu(null)
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {detailPanel && (
          <div className="w-[33%] min-h-0 bg-background border-l border-border flex flex-col shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-secondary/30">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">节点详情</div>
                <div className="text-[11px] text-muted-foreground truncate">ID: {detailPanel.nodeId}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">字号</span>
                <button
                  onClick={() => setDetailFontSize((size) => Math.max(12, size - 1))}
                  className="px-1.5 py-1 text-xs rounded border border-border hover:bg-accent"
                  title="减小字号"
                >
                  A-
                </button>
                <input
                  type="range"
                  min={12}
                  max={24}
                  value={detailFontSize}
                  onChange={(e) => setDetailFontSize(Number(e.target.value))}
                  className="w-24"
                />
                <button
                  onClick={() => setDetailFontSize((size) => Math.min(24, size + 1))}
                  className="px-1.5 py-1 text-xs rounded border border-border hover:bg-accent"
                  title="增大字号"
                >
                  A+
                </button>
                <button
                  onClick={() => setDetailPanel(null)}
                  className="p-1 rounded-md hover:bg-accent transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5"
              onWheelCapture={(event) => event.stopPropagation()}
            >
              {detailPanel.question.trim() && (
                <div className="mb-4 rounded border border-border bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground mb-1">问题</div>
                  <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{detailPanel.question}</div>
                </div>
              )}
              <div
                className="prose prose-slate dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground"
                style={{
                  fontSize: `${detailFontSize}px`,
                  lineHeight: 1.7
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{detailPanel.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>

      {metaEditor && (
        <div
          className="fixed inset-0 bg-black/40 z-[10000] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMetaEditor(null)
          }}
        >
          <div className="w-full max-w-[520px] bg-background text-foreground rounded-xl border border-border shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">编辑标签与备注</h3>
              <button onClick={() => setMetaEditor(null)} className="p-1 rounded hover:bg-accent">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">标签（逗号分隔）</label>
              <input
                value={metaEditor.tagsText}
                onChange={(e) => setMetaEditor({ ...metaEditor, tagsText: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded border border-border"
                placeholder="重要, 待复习, 已掌握"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">备注</label>
              <textarea
                value={metaEditor.note}
                onChange={(e) => setMetaEditor({ ...metaEditor, note: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 text-sm rounded border border-border resize-none"
                placeholder="记录你的理解、疑问或待办"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMetaEditor(null)}
                className="px-3 py-2 text-sm rounded border border-border hover:bg-accent"
              >
                取消
              </button>
              <button
                onClick={handleSaveNodeMeta}
                className="px-3 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {versionDialog && (
        <div
          className="fixed inset-0 bg-black/40 z-[10000] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setVersionDialog(null)
          }}
        >
          <div className="w-full max-w-[980px] max-h-[80vh] overflow-hidden bg-background text-foreground rounded-xl border border-border shadow-xl flex">
            <div className="w-[280px] border-r border-border p-3 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">版本历史</h3>
                <button onClick={() => setVersionDialog(null)} className="p-1 rounded hover:bg-accent">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {versionDialog.versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无历史版本</p>
              ) : (
                <div className="space-y-1.5">
                  {versionDialog.versions.map((version, index) => (
                    <button
                      key={`${version.timestamp}-${index}`}
                      onClick={() => setSelectedVersionIndex(index)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 rounded border text-xs',
                        selectedVersionIndex === index
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'border-border hover:bg-accent'
                      )}
                    >
                      <div>版本 {index + 1}</div>
                      <div className="text-[11px] opacity-70 mt-0.5">{new Date(version.timestamp).toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Diff：历史版本 vs 当前内容</div>
                <button
                  onClick={handleRestoreVersion}
                  disabled={versionDialog.versions.length === 0}
                  className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                >
                  恢复选中版本
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-muted/35">
                {versionDialog.versions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">没有可对比内容</div>
                ) : (
                  <pre className="text-xs leading-relaxed">
                    {selectedDiffLines.map((line, index) => (
                      <div
                        key={`${line.type}-${index}`}
                        className={cn(
                          'px-2 py-0.5 rounded',
                          line.type === 'added' && 'bg-green-100 text-green-800 dark:bg-green-950/45 dark:text-green-200',
                          line.type === 'removed' && 'bg-red-100 text-red-800 dark:bg-red-950/45 dark:text-red-200',
                          line.type === 'same' && 'text-foreground/80'
                        )}
                      >
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '} {line.text}
                      </div>
                    ))}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
