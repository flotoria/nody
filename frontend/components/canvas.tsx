"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactFlow, {
  Background,
  BackgroundVariant,
  Connection,
  ConnectionMode,
  Edge,
  MarkerType,
  Node,
  ReactFlowProvider,
  useReactFlow,
  NodeProps,
  NodeTypes,
  OnEdgesDelete,
  OnSelectionChangeParams,
  useEdgesState,
  useNodesState,
  Handle,
  Position,
  NodeResizer,
  NodeChange,
} from "reactflow"
import "reactflow/dist/style.css"
import type React from "react"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CodeEditor } from "@/components/code-editor"
import { FileNamingModal } from "@/components/file-naming-modal"
import { FolderNamingModal } from "@/components/folder-naming-modal"
import { EdgeCreationModal } from "@/components/edge-creation-modal"
import { NodeConfigurationModal, NodeConfiguration } from "@/components/node-configuration-modal"
import {
  FileAPI,
  FileNode as ApiFileNode,
  FolderNode as ApiFolderNode,
  NodeMetadata,
} from "@/lib/api"
import { toast } from "sonner"
import { FileText, Folder as FolderIcon, Sparkles, Trash2 } from "lucide-react"

// Category color mapping system
const getCategoryColors = (category: string) => {
  const categoryMap: Record<string, {
    primary: string
    secondary: string
    accent: string
    border: string
    bg: string
    text: string
  }> = {
    "Files": {
      primary: "#fb923c", // orange-400
      secondary: "#fdba74", // orange-300
      accent: "#f97316", // orange-500
      border: "#fb923c4d", // orange-400/30
      bg: "#fb923c1a", // orange-400/10
      text: "#fb923c" // orange-400
    },
    "AI / ML Boilerplates": {
      primary: "#a855f7", // purple-400
      secondary: "#c084fc", // purple-300
      accent: "#9333ea", // purple-500
      border: "#a855f74d", // purple-400/30
      bg: "#a855f71a", // purple-400/10
      text: "#a855f7" // purple-400
    },
    "Web & API": {
      primary: "#60a5fa", // blue-400
      secondary: "#93c5fd", // blue-300
      accent: "#3b82f6", // blue-500
      border: "#60a5fa4d", // blue-400/30
      bg: "#60a5fa1a", // blue-400/10
      text: "#60a5fa" // blue-400
    },
    "Backend Logic": {
      primary: "#818cf8", // indigo-400
      secondary: "#a5b4fc", // indigo-300
      accent: "#6366f1", // indigo-500
      border: "#818cf84d", // indigo-400/30
      bg: "#818cf81a", // indigo-400/10
      text: "#818cf8" // indigo-400
    },
    "Database & Data Flow": {
      primary: "#4ade80", // green-400
      secondary: "#86efac", // green-300
      accent: "#22c55e", // green-500
      border: "#4ade804d", // green-400/30
      bg: "#4ade801a", // green-400/10
      text: "#4ade80" // green-400
    },
    "DevOps & Infra": {
      primary: "#2dd4bf", // teal-400
      secondary: "#5eead4", // teal-300
      accent: "#14b8a6", // teal-500
      border: "#2dd4bf4d", // teal-400/30
      bg: "#2dd4bf1a", // teal-400/10
      text: "#2dd4bf" // teal-400
    },
    "Frontend / UI": {
      primary: "#f472b6", // pink-400
      secondary: "#f9a8d4", // pink-300
      accent: "#ec4899", // pink-500
      border: "#f472b64d", // pink-400/30
      bg: "#f472b61a", // pink-400/10
      text: "#f472b6" // pink-400
    },
    "Security & Auth": {
      primary: "#f87171", // red-400
      secondary: "#fca5a5", // red-300
      accent: "#ef4444", // red-500
      border: "#f871714d", // red-400/30
      bg: "#f871711a", // red-400/10
      text: "#f87171" // red-400
    },
    "Utility / Common": {
      primary: "#22d3ee", // cyan-400
      secondary: "#67e8f9", // cyan-300
      accent: "#06b6d4", // cyan-500
      border: "#22d3ee4d", // cyan-400/30
      bg: "#22d3ee1a", // cyan-400/10
      text: "#22d3ee" // cyan-400
    }
  }
  
  return categoryMap[category] || {
    primary: "#9ca3af", // gray-400
    secondary: "#d1d5db", // gray-300
    accent: "#6b7280", // gray-500
    border: "#9ca3af4d", // gray-400/30
    bg: "#9ca3af1a", // gray-400/10
    text: "#9ca3af" // gray-400
  }
}

const NODE_WIDTH = 280
const NODE_HEIGHT = 180
const FOLDER_HEADER_HEIGHT = 72
const FOLDER_COLLAPSED_HEIGHT = 96
const HANDLE_CLASS =
  "h-3 w-3 rounded-full border-2 border-background bg-primary shadow-sm hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
const HANDLE_STYLE: React.CSSProperties = { width: 12, height: 12, zIndex: 10 }

const NodeHandles = ({ isConnectable }: { isConnectable: boolean }) => (
  <>
    <Handle
      type="target"
      id="target-left"
      position={Position.Left}
      className={HANDLE_CLASS}
      style={HANDLE_STYLE}
      isConnectable={isConnectable}
    />
    <Handle
      type="target"
      id="target-top"
      position={Position.Top}
      className={HANDLE_CLASS}
      style={HANDLE_STYLE}
      isConnectable={isConnectable}
    />
    <Handle
      type="source"
      id="source-right"
      position={Position.Right}
      className={HANDLE_CLASS}
      style={HANDLE_STYLE}
      isConnectable={isConnectable}
    />
    <Handle
      type="source"
      id="source-bottom"
      position={Position.Bottom}
      className={HANDLE_CLASS}
      style={HANDLE_STYLE}
      isConnectable={isConnectable}
    />
  </>
)

interface CanvasProps {
  selectedNode: string | null
  onSelectNode: (id: string | null) => void
  onNodeDrop?: (nodeData: any, position: { x: number; y: number }) => void
  onDataChange?: (nodes: ApiFileNode[], metadata: Record<string, NodeMetadata>) => void
  onMetadataUpdate?: (metadata: Record<string, NodeMetadata>) => void
}

type FileNodeData = {
  kind: "file"
  fileId: string
  label: string
  fileType?: string
  filePath?: string
  status: ApiFileNode["status"]
  content?: string
  isModified?: boolean
  parentFolder?: string | null
  generating: boolean
  running: boolean
  description?: string
  category?: string
  onOpen: (id: string) => void
  onGenerate: (id: string) => void
  onRun?: (id: string) => void
  onStop?: (id: string) => void
  onDelete: (id: string) => void
}

type FolderNodeData = {
  kind: "folder"
  folderId: string
  name: string
  width: number
  height: number
  isExpanded: boolean
  containedFiles: string[]
  isHovered?: boolean
  onDelete?: (id: string) => void
}

type GenericNodeData = {
  kind: "generic"
  label: string
  category: string
}

type CanvasNodeData = FileNodeData | FolderNodeData | GenericNodeData

type EdgeRecord = {
  from: string
  to: string
  type?: string
  description?: string
}

type BoilerplateTemplate = {
  defaultFileName: string
  fileType: string
  description: string
  content: string
}

type SidebarDragPayload = {
  label?: string
  type?: string
  isSpecial?: boolean
  description?: string
  template?: BoilerplateTemplate
  categoryLabel?: string
}

type PendingNodeConfig = {
  type: string
  position: { x: number; y: number }
  label?: string
  initialValues?: Partial<NodeConfiguration> & { fileType?: string; fileName?: string }
  template?: BoilerplateTemplate
  categoryLabel?: string
}

const isFileNodeData = (data: CanvasNodeData): data is FileNodeData => data.kind === "file"

const FileNodeComponent = memo(({ id, data, selected, isConnectable }: NodeProps<FileNodeData>) => {
  const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1)
  const hasExistingContent = Boolean(data.content && data.content.trim().length > 0)
  const colors = getCategoryColors(data.category || "Files")

  return (
    <div
      className="relative rounded-2xl border bg-card/90 shadow-lg transition-all"
      style={{ 
        width: NODE_WIDTH,
        borderColor: selected ? colors.primary : colors.border,
        boxShadow: selected ? `0 0 0 2px ${colors.primary}40` : undefined
      }}
    >
      <NodeHandles isConnectable={isConnectable} />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div 
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ 
                backgroundColor: colors.bg,
                color: colors.text
              }}
            >
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground" title={data.label}>
                {data.label}
              </p>
              <p className="text-xs font-mono text-muted-foreground">{data.fileType || "text"}</p>
            </div>
          </div>
          {data.generating ? (
            <Sparkles 
              className="h-4 w-4 animate-spin" 
              style={{ color: colors.text }}
            />
          ) : null}
        </div>

        {data.category && (
          <span 
            className="inline-flex w-fit items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{ 
              backgroundColor: colors.bg,
              color: colors.text
            }}
          >
            {data.category}
          </span>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Status: <span className="font-medium text-foreground">{statusLabel}</span>
          </span>
          {data.parentFolder && (
            <span>
              Folder: <span className="font-medium text-foreground">{data.parentFolder}</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => data.onOpen(id)}
          >
            Open
          </Button>
          {hasExistingContent && !data.running && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-green-600"
              onClick={() => data.onRun?.(id)}
            >
              Run
            </Button>
          )}
          {hasExistingContent && data.running && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-red-600"
              onClick={() => data.onStop?.(id)}
            >
              Stop
            </Button>
          )}
          {!hasExistingContent && data.description && data.description.trim() && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              style={{ color: colors.text }}
              onClick={() => data.onGenerate(id)}
              disabled={data.generating}
            >
              Generate
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive"
            onClick={() => data.onDelete(id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
})

FileNodeComponent.displayName = "FileNodeComponent"

const FolderNodeComponent = memo(({ data, selected, isConnectable }: NodeProps<FolderNodeData>) => {
  const height = data.isExpanded ? data.height : FOLDER_COLLAPSED_HEIGHT
  const colors = getCategoryColors("Files") // Folders are always in the Files category

  return (
    <div
      className="relative rounded-2xl border-2 bg-card/90 transition-all"
      style={{ 
        width: data.width, 
        height,
        borderColor: selected ? colors.primary : colors.border
      }}
    >
      <NodeResizer
        color={colors.primary}
        isVisible={selected}
        minWidth={300}
        minHeight={200}
        handleStyle={{
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          backgroundColor: colors.primary,
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
        lineStyle={{
          borderColor: colors.primary,
          borderWidth: '2px',
        }}
      />
      <NodeHandles isConnectable={isConnectable} />
      <div className="flex h-full flex-col">
        <div 
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ 
            borderColor: colors.border,
            backgroundColor: colors.bg
          }}
        >
          <div 
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ 
              backgroundColor: colors.bg,
              color: colors.text
            }}
          >
            <FolderIcon className="h-4 w-4" />
          </div>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-semibold text-foreground">{data.name}</span>
            <span className="text-xs text-muted-foreground">
              {data.containedFiles.length} file{data.containedFiles.length === 1 ? "" : "s"}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive/80"
            onClick={() => data.onDelete?.(data.folderId)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {data.isExpanded ? (
          <div className="flex-1 px-4 py-3 text-xs text-muted-foreground">
            Drag files into this region to organize them.
          </div>
        ) : (
          <div className="flex-1 px-4 py-3 text-xs text-muted-foreground italic">
            Folder collapsed
          </div>
        )}
      </div>
    </div>
  )
})

FolderNodeComponent.displayName = "FolderNodeComponent"

const GenericNodeComponent = memo(({ data, selected, isConnectable }: NodeProps<GenericNodeData>) => {
  const colors = getCategoryColors(data.category || "Custom")
  
  return (
    <div
      className="relative rounded-2xl border bg-card/90 px-4 py-3 shadow-md transition-all"
      style={{ 
        width: 220,
        borderColor: selected ? colors.primary : colors.border,
        boxShadow: selected ? `0 0 0 2px ${colors.primary}40` : undefined
      }}
    >
      <NodeHandles isConnectable={isConnectable} />
      <p 
        className="text-xs uppercase tracking-wide"
        style={{ color: colors.text }}
      >
        {data.category}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{data.label}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Placeholder node. Connect or convert this into concrete implementation.
      </p>
    </div>
  )
})

GenericNodeComponent.displayName = "GenericNodeComponent"

const nodeTypes = {
  fileNode: FileNodeComponent,
  folderNode: FolderNodeComponent,
  genericNode: GenericNodeComponent,
} satisfies NodeTypes

function CanvasInner({ selectedNode, onSelectNode, onDataChange, onMetadataUpdate }: CanvasProps) {
  const [flowNodes, setFlowNodes, onNodesChangeBase] = useNodesState([])
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge[]>([])
  const [selectedEdges, setSelectedEdges] = useState<string[]>([])
  const [fileRecords, setFileRecords] = useState<ApiFileNode[]>([])
  const [metadataRecords, setMetadataRecords] = useState<Record<string, NodeMetadata>>({})
  const [folderRecords, setFolderRecords] = useState<ApiFolderNode[]>([])
  const [edgeRecords, setEdgeRecords] = useState<EdgeRecord[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(selectedNode)
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null)
  const [customGenericNodes, setCustomGenericNodes] = useState<Node<GenericNodeData>[]>([])
  const [showFileModal, setShowFileModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [showNodeConfigModal, setShowNodeConfigModal] = useState(false)
  const [pendingFilePosition, setPendingFilePosition] = useState<{ x: number; y: number } | null>(null)
  const [pendingFolderPosition, setPendingFolderPosition] = useState<{ x: number; y: number } | null>(null)
  const [pendingNodeConfig, setPendingNodeConfig] = useState<PendingNodeConfig | null>(null)

  // Custom onNodesChange handler to detect resize changes
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChangeBase(changes)
    
    // Handle resize changes for folders (optimized for smoothness)
    for (const change of changes) {
      if (change.type === 'dimensions' && change.dimensions) {
        const node = flowNodes.find(n => n.id === change.id)
        if (node?.type === 'folderNode') {
          // Update folder dimensions in real-time (smooth UI update)
          const width = change.dimensions.width
          const height = change.dimensions.height
          
          // Update the node's style immediately for smooth resizing
          setFlowNodes(prevNodes => 
            prevNodes.map(n => 
              n.id === change.id 
                ? { ...n, style: { ...n.style, width, height } }
                : n
            )
          )
          
          // Debounce backend updates to avoid performance issues
          // Only update backend when resize is complete (not during dragging)
          if (change.dimensions.width && change.dimensions.height) {
            // Use setTimeout to debounce rapid resize events
            setTimeout(() => {
              FileAPI.updateFolder(change.id, { width, height }).catch(console.error)
            }, 100)
          }
        }
      }
    }
  }, [onNodesChangeBase, flowNodes])
  const [pendingEdge, setPendingEdge] = useState<{ from: string; to: string } | null>(null)
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null)
  const [runningNodeIds, setRunningNodeIds] = useState<Set<string>>(new Set())
  const [expandedNode, setExpandedNode] = useState<string | null>(null)
  const [pendingFileDrop, setPendingFileDrop] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null)
  const refreshInFlight = useRef(false)
  const { screenToFlowPosition } = useReactFlow()
  
  // Store EventSource references to close them when stopping files
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map())

  useEffect(() => {
    setSelectedNodeId(selectedNode)
  }, [selectedNode])

  // Poll file statuses to keep running state in sync
  useEffect(() => {
    const checkRunningFiles = async () => {
      if (fileRecords.length === 0) return
      
      // Check status of all files
      const statusChecks = fileRecords.map(file => FileAPI.getFileStatus(file.id))
      const statuses = await Promise.all(statusChecks)
      
      const newRunningIds = new Set<string>()
      statuses.forEach((status, index) => {
        if (status.running) {
          newRunningIds.add(fileRecords[index].id)
        }
      })
      
      // Only update if changed
      setRunningNodeIds(prev => {
        const prevArray = Array.from(prev).sort()
        const newArray = Array.from(newRunningIds).sort()
        if (JSON.stringify(prevArray) !== JSON.stringify(newArray)) {
          return newRunningIds
        }
        return prev
      })
    }
    
    // Check immediately on mount
    checkRunningFiles()
    
    // Then poll every 2 seconds
    const interval = setInterval(checkRunningFiles, 2000)
    
    return () => {
      clearInterval(interval)
      // Clean up all EventSources on unmount
      eventSourcesRef.current.forEach(eventSource => {
        eventSource.close()
      })
      eventSourcesRef.current.clear()
    }
  }, [fileRecords])

  useEffect(() => {
    let mounted = true
    let pollInterval: NodeJS.Timeout | null = null

    const loadData = async () => {
      try {
        const [files, metadataResponse, folders, edges] = await Promise.all([
          FileAPI.getFiles(),
          FileAPI.getMetadataRaw(),
          FileAPI.getFolders(),
          FileAPI.getEdges(),
        ])
        if (!mounted) return
        
        // Parse raw metadata
        const metadata = JSON.parse(metadataResponse.content)
        
        // Only update if data has actually changed
        setFileRecords(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(files)) {
            console.log('Canvas: Files updated from polling:', files)
            return files
          }
          return prev
        })
        
        setMetadataRecords(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(metadata)) {
            console.log('Canvas: Metadata updated from polling:', metadata)
            return metadata
          }
          return prev
        })
        
        setFolderRecords(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(folders)) {
            console.log('Canvas: Folders updated from polling:', folders)
            return folders
          }
          return prev
        })
        
        setEdgeRecords(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(edges)) {
            console.log('Canvas: Edges updated from polling:', edges)
            return edges
          }
          return prev
        })
      } catch (error) {
        console.error("Failed to load canvas data:", error)
        if (mounted) {
          toast.error("Failed to load workspace data")
        }
      }
    }

    const loadInitialData = async () => {
      setLoading(true)
      await loadData()
      if (mounted) {
        setLoading(false)
      }
    }

    // Load initial data
    loadInitialData()

    // Set up polling for real-time updates
    pollInterval = setInterval(loadData, 500) // Poll every 500ms for faster updates

    return () => {
      mounted = false
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [])

  useEffect(() => {
    if (onDataChange) {
      onDataChange(fileRecords, metadataRecords)
    }
  }, [fileRecords, metadataRecords, onDataChange])

  useEffect(() => {
    if (onMetadataUpdate) {
      onMetadataUpdate(metadataRecords)
    }
  }, [metadataRecords, onMetadataUpdate])

  // Force refresh when metadata changes significantly
  useEffect(() => {
    const refreshData = async () => {
      try {
        const [files, metadata, folders, edges] = await Promise.all([
          FileAPI.getFiles(),
          FileAPI.getMetadata(),
          FileAPI.getFolders(),
          FileAPI.getEdges(),
        ])
        setFileRecords(files)
        setMetadataRecords(metadata)
        setFolderRecords(folders)
        setEdgeRecords(edges)
      } catch (error) {
        console.error("Failed to refresh data:", error)
      }
    }
    
    // Refresh when metadata records change
    if (Object.keys(metadataRecords).length > 0) {
      refreshData()
    }
  }, [Object.keys(metadataRecords).length])

  const openEditor = useCallback((id: string) => setEditorNodeId(id), [])

  const handleFileDelete = useCallback(
    async (id: string) => {
      const file = fileRecords.find((record) => record.id === id)
      const confirmed =
        typeof window === "undefined" ||
        window.confirm(`Delete ${file?.label ?? "this file"} from the canvas?`)
      if (!confirmed) return

      try {
        await FileAPI.deleteFile(id)
        const [files, metadata, folders] = await Promise.all([
          FileAPI.getFiles(),
          FileAPI.getMetadata(),
          FileAPI.getFolders(),
        ])
        setFileRecords(files)
        setMetadataRecords(metadata)
        setFolderRecords(folders)
        toast.success("File deleted")
      } catch (error) {
        console.error("Failed to delete file:", error)
        toast.error("Failed to delete file")
      }
    },
    [fileRecords],
  )

  const handleFolderDelete = useCallback(
    async (id: string) => {
      const folder = folderRecords.find((record) => record.id === id)
      const containedFileCount = folder?.containedFiles?.length || 0
      const confirmMessage = containedFileCount > 0
        ? `Delete "${folder?.name ?? "this folder"}" and all ${containedFileCount} file(s) inside?`
        : `Delete "${folder?.name ?? "this folder"}"?`
      
      const confirmed =
        typeof window === "undefined" ||
        window.confirm(confirmMessage)
      if (!confirmed) return

      try {
        await FileAPI.deleteFolder(id)
        const [files, metadata, folders] = await Promise.all([
          FileAPI.getFiles(),
          FileAPI.getMetadata(),
          FileAPI.getFolders(),
        ])
        setFileRecords(files)
        setMetadataRecords(metadata)
        setFolderRecords(folders)
        toast.success("Folder deleted")
      } catch (error) {
        console.error("Failed to delete folder:", error)
        toast.error("Failed to delete folder")
      }
    },
    [folderRecords],
  )

  const handleGenerateCode = useCallback(
    async (id: string) => {
      setGeneratingNodeId(id)
      try {
        const result = await FileAPI.generateFileCode(id)
        if (result.success) {
          toast.success("Code generated successfully")
          const [files, metadata] = await Promise.all([
            FileAPI.getFiles(),
            FileAPI.getMetadata(),
          ])
          setFileRecords(files)
          setMetadataRecords(metadata)
        } else {
          toast.error("Failed to generate code")
        }
      } catch (error) {
        console.error("Failed to generate code:", error)
        toast.error("Failed to generate code")
      } finally {
        setGeneratingNodeId(null)
      }
    },
    [],
  )

  const handleRunFile = useCallback(
    async (id: string) => {
      // Add to running set
      setRunningNodeIds(prev => new Set(prev).add(id))
      
      try {
        const result = await FileAPI.runFile(
          id,
          // onOutput callback
          (output) => {
            console.log('File output:', output)
            // Output is displayed in terminal via output_logger on backend
          },
          // onComplete callback
          (success, returnCode) => {
            if (success) {
              toast.success(`File executed successfully`)
            } else {
              toast.error(`File execution failed (exit code: ${returnCode})`)
            }
            // Remove from running set
            setRunningNodeIds(prev => {
              const newSet = new Set(prev)
              newSet.delete(id)
              return newSet
            })
            // Clean up EventSource
            const eventSource = eventSourcesRef.current.get(id)
            if (eventSource) {
              eventSource.close()
              eventSourcesRef.current.delete(id)
            }
          }
        )
        
        if (!result.success) {
          toast.error(`Failed to start file: ${result.error}`)
          // Remove from running set on error
          setRunningNodeIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(id)
            return newSet
          })
        } else {
          toast.info(`File started - check terminal for output`)
          // Store EventSource reference
          if (result.eventSource) {
            eventSourcesRef.current.set(id, result.eventSource)
          }
        }
      } catch (error) {
        console.error("Failed to run file:", error)
        toast.error("Failed to run file")
        // Remove from running set on error
        setRunningNodeIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
      }
    },
    [],
  )

  const handleStopFile = useCallback(
    async (id: string) => {
      try {
        // Show immediate feedback that stop was registered
        toast.info("Stopping file...")
        
        // Close EventSource first
        const eventSource = eventSourcesRef.current.get(id)
        if (eventSource) {
          eventSource.close()
          eventSourcesRef.current.delete(id)
        }
        
        const result = await FileAPI.stopFile(id)
        if (result.success) {
          toast.success(`File stopped successfully`)
          // Remove from running set
          setRunningNodeIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(id)
            return newSet
          })
        } else {
          toast.error(`Failed to stop file: ${result.error}`)
        }
      } catch (error) {
        console.error("Failed to stop file:", error)
        toast.error("Failed to stop file")
      }
    },
    [],
  )

  const handleFileSave = useCallback(async (nodeId: string, content: string) => {
    try {
      await FileAPI.updateFileContent(nodeId, content)
      setFileRecords((prev) =>
        prev.map((record) =>
          record.id === nodeId ? { ...record, content, isModified: false } : record,
        ),
      )
    } catch (error) {
      console.error("Failed to save file:", error)
      throw error
    }
  }, [])

  const defaultFilePosition = useCallback((): { x: number; y: number } => {
    const offset = (fileRecords.length + folderRecords.length) * 40
    return { x: 160 + offset, y: 160 + offset }
  }, [fileRecords.length, folderRecords.length])

  const handleFileCreate = useCallback(
    async (fileName: string, fileType: string, description?: string) => {
      try {
        const result = await FileAPI.createFile({
          filePath: fileName,
          fileType,
          content: "",
          description: description ?? "",
        })

        if (!result.success || !result.data) {
          toast.error(result.error || "Failed to create file")
          return
        }

        const position = pendingFilePosition ?? defaultFilePosition()
        await FileAPI.updateFilePosition(result.data.id, position.x, position.y)

        const [files, metadata] = await Promise.all([
          FileAPI.getFiles(),
          FileAPI.getMetadata(),
        ])
        setFileRecords(files)
        setMetadataRecords(metadata)
        toast.success("File created")
      } catch (error) {
        console.error("Failed to create file:", error)
        toast.error("Failed to create file")
      } finally {
        setPendingFilePosition(null)
      }
    },
    [defaultFilePosition, pendingFilePosition],
  )

  const handleFolderCreate = useCallback(
    async (folderName: string) => {
      if (!pendingFolderPosition) return

      try {
        const width = 640
        const height = 420
        const folderX = pendingFolderPosition.x - width / 2
        const folderY = pendingFolderPosition.y - FOLDER_HEADER_HEIGHT / 2

        const created = await FileAPI.createFolder(folderName, folderX, folderY, width, height)
        const [folders, metadata] = await Promise.all([
          FileAPI.getFolders(),
          FileAPI.getMetadata(),
        ])
        setFolderRecords(folders)
        setMetadataRecords(metadata)
        setSelectedNodeId(created.id)
        onSelectNode(created.id)
        toast.success("Folder created successfully")
      } catch (error) {
        console.error("Failed to create folder:", error)
        toast.error("Failed to create folder")
      } finally {
        setPendingFolderPosition(null)
      }
    },
    [pendingFolderPosition, onSelectNode],
  )

  const rebuildNodes = useCallback((): Node<CanvasNodeData>[] => {
    const nodes: Node<CanvasNodeData>[] = []

    const appendFileNode = (record: ApiFileNode) => {
      const meta = metadataRecords[record.id]
      let position = meta ? { x: meta.x ?? 120, y: meta.y ?? 120 } : { x: 120, y: 120 }
      
      // If the file belongs to a folder, convert absolute position to relative position
      if (record.parentFolder) {
        const parentFolder = folderRecords.find(f => f.id === record.parentFolder)
        if (parentFolder) {
          // Convert absolute position to relative to parent folder
          position = {
            x: position.x - parentFolder.x,
            y: position.y - parentFolder.y
          }
        }
      }
      
      nodes.push({
        id: record.id,
        type: "fileNode",
        position,
        data: {
          kind: "file",
          fileId: record.id,
          label: record.label,
          fileType: record.fileType,
          filePath: record.filePath,
          status: record.status,
          content: record.content,
          isModified: record.isModified,
          parentFolder: record.parentFolder ?? null,
          generating: generatingNodeId === record.id,
          running: runningNodeIds.has(record.id),
          description: meta?.description,
          category: record.category || meta?.category,
          onOpen: openEditor,
          onGenerate: handleGenerateCode,
          onRun: handleRunFile,
          onStop: handleStopFile,
          onDelete: handleFileDelete,
        },
        style: { width: NODE_WIDTH, zIndex: 2 },
        draggable: true,
        selectable: true,
        connectable: true,
        parentId: record.parentFolder ?? undefined,
      })
    }

    for (const record of fileRecords) {
      appendFileNode(record)
    }

    for (const folder of folderRecords) {
      const height = folder.isExpanded ? folder.height : FOLDER_COLLAPSED_HEIGHT
      nodes.push({
        id: folder.id,
        type: "folderNode",
        position: { x: folder.x, y: folder.y },
        data: {
          kind: "folder",
          folderId: folder.id,
          name: folder.name,
          width: folder.width,
          height,
          isExpanded: folder.isExpanded,
          containedFiles: folder.containedFiles,
          isHovered: hoveredFolderId === folder.id,
          onDelete: handleFolderDelete,
        },
        draggable: true,
        selectable: true,
        style: { 
          width: folder.width, 
          height: height,
          zIndex: 1 
        },
        connectable: true,
      })
    }

    for (const generic of customGenericNodes) {
      nodes.push(generic)
    }

    const selection = selectedNodeId ?? null

    return nodes.map((node) => ({
      ...node,
      selected: selection !== null && node.id === selection,
    }))
  }, [
    fileRecords,
    folderRecords,
    metadataRecords,
    generatingNodeId,
    runningNodeIds,
    handleFileDelete,
    handleGenerateCode,
    handleRunFile,
    openEditor,
    customGenericNodes,
    selectedNodeId,
    hoveredFolderId,
  ])

  const rebuildEdges = useCallback((): Edge[] => {
    return edgeRecords.map((edge, index) => {
      const typeLabel = edge.type ? edge.type.replace(/_/g, " ") : undefined
      return {
        id: `edge-${edge.from}-${edge.to}-${index}`,
        source: edge.from,
        target: edge.to,
        label: typeLabel,
        data: { type: edge.type ?? "depends_on", description: edge.description },
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        style: {
          pointerEvents: "stroke" as React.CSSProperties["pointerEvents"],
          cursor: "pointer",
          strokeWidth: 2,
        },
        zIndex: 1000,
      }
    })
  }, [edgeRecords])

  useEffect(() => {
    setFlowNodes(rebuildNodes())
  }, [rebuildNodes, setFlowNodes])

  useEffect(() => {
    setFlowEdges(rebuildEdges())
  }, [rebuildEdges, setFlowEdges])

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return
      }
      const duplicateEdge = edgeRecords.some(
        (edge) => edge.from === connection.source && edge.to === connection.target,
      )
      if (duplicateEdge) {
        toast("Those nodes are already connected")
        return
      }
      setPendingEdge({ from: connection.source, to: connection.target })
    },
    [edgeRecords],
  )

  const handleEdgeCreate = useCallback(
    async (edgeData: { type: string; description?: string }) => {
      if (!pendingEdge) return
      try {
        const duplicateEdge = edgeRecords.some(
          (edge) => edge.from === pendingEdge.from && edge.to === pendingEdge.to,
        )
        if (duplicateEdge) {
          toast("Those nodes are already connected")
          return
        }

        await FileAPI.createEdge({
          from: pendingEdge.from,
          to: pendingEdge.to,
          type: edgeData.type,
          description: edgeData.description,
        })
        const edges = await FileAPI.getEdges()
        setEdgeRecords(edges)
        toast.success("Edge created")
      } catch (error) {
        console.error("Failed to create edge:", error)
        toast.error("Failed to create edge")
      } finally {
        setPendingEdge(null)
      }
    },
    [edgeRecords, pendingEdge],
  )

  const handleEdgesDelete: OnEdgesDelete = useCallback(async (edges) => {
    for (const edge of edges) {
      try {
        const type = (edge.data as { type?: string } | undefined)?.type || "depends_on"
        await FileAPI.deleteEdge(edge.source, edge.target, type)
      } catch (error) {
        console.error("Failed to delete edge:", error)
        toast.error("Failed to delete edge")
      }
    }
    const updatedEdges = await FileAPI.getEdges()
    setEdgeRecords(updatedEdges)
  }, [])

  const handleNodesDelete = useCallback(
    async (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === "fileNode") {
          await handleFileDelete(node.id)
        }
        if (node.type === "folderNode") {
          try {
            await FileAPI.deleteFolder(node.id)
          } catch (error) {
            console.error("Failed to delete folder:", error)
            toast.error("Failed to delete folder")
          }
        }
        if (node.type === "genericNode") {
          setCustomGenericNodes((prev) => prev.filter((item) => item.id !== node.id))
        }
      }
      const [files, metadata, folders] = await Promise.all([
        FileAPI.getFiles(),
        FileAPI.getMetadata(),
        FileAPI.getFolders(),
      ])
      setFileRecords(files)
      setMetadataRecords(metadata)
      setFolderRecords(folders)
    },
    [handleFileDelete],
  )

  const refreshMetadata = useCallback(async () => {
    if (refreshInFlight.current) return
    refreshInFlight.current = true
    try {
      const [files, metadata, folders] = await Promise.all([
        FileAPI.getFiles(),
        FileAPI.getMetadata(),
        FileAPI.getFolders(),
      ])
      setFileRecords(files)
      setMetadataRecords(metadata)
      setFolderRecords(folders)
    } finally {
      refreshInFlight.current = false
    }
  }, [])

  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node<CanvasNodeData>) => {
      if (node.type === "fileNode" && isFileNodeData(node.data)) {
        const { x, y } = node.position
        const nodeCenterX = x + NODE_WIDTH / 2
        const nodeCenterY = y + NODE_HEIGHT / 2

        const containingFolder = folderRecords.find((folder) => {
          const left = folder.x
          const right = folder.x + folder.width
          const top = folder.y + FOLDER_HEADER_HEIGHT
          const bottom = folder.isExpanded
            ? folder.y + folder.height
            : folder.y + FOLDER_COLLAPSED_HEIGHT
          return nodeCenterX >= left && nodeCenterX <= right && nodeCenterY >= top && nodeCenterY <= bottom
        })

        const targetFolderId = containingFolder ? containingFolder.id : null
        setHoveredFolderId(targetFolderId)
      }
    },
    [folderRecords]
  )

  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node<CanvasNodeData>) => {
      // Clear hover state when drag stops
      setHoveredFolderId(null)
      
      if (node.type === "fileNode" && isFileNodeData(node.data)) {
        const fileId = node.id
        let { x, y } = node.position
        const fileData = node.data as FileNodeData

        // If the file has a parent, convert relative position to absolute
        if (fileData.parentFolder) {
          const parentFolder = folderRecords.find(f => f.id === fileData.parentFolder)
          if (parentFolder) {
            x = x + parentFolder.x
            y = y + parentFolder.y
          }
        }

        try {
          await FileAPI.updateFilePosition(fileId, x, y)
        } catch (error) {
          console.error("Failed to update file position:", error)
        }

        const nodeCenterX = x + NODE_WIDTH / 2
        const nodeCenterY = y + NODE_HEIGHT / 2

        const containingFolder = folderRecords.find((folder) => {
          const left = folder.x
          const right = folder.x + folder.width
          const top = folder.y + FOLDER_HEADER_HEIGHT
          const bottom = folder.isExpanded
            ? folder.y + folder.height
            : folder.y + FOLDER_COLLAPSED_HEIGHT
          return nodeCenterX >= left && nodeCenterX <= right && nodeCenterY >= top && nodeCenterY <= bottom
        })

        const targetFolderId = containingFolder ? containingFolder.id : null
        const currentParent = fileData.parentFolder

        if (currentParent !== targetFolderId) {
          try {
            await FileAPI.moveFileToFolder(fileId, targetFolderId)
            await refreshMetadata()
          } catch (error) {
            console.error("Failed to move file to folder:", error)
            toast.error("Failed to move file to folder")
          }
        }
      }

      if (node.type === "folderNode") {
        const folderId = node.id
        try {
          // Get the old folder position before updating
          const oldFolder = folderRecords.find(f => f.id === folderId)
          
          // Update folder position and dimensions if resized
          const updates: any = { x: node.position.x, y: node.position.y }
          if (node.style?.width) {
            updates.width = node.style.width
          }
          if (node.style?.height) {
            updates.height = node.style.height
          }
          await FileAPI.updateFolder(folderId, updates)
          
          // Update all child file positions to maintain their relative positions
          if (oldFolder) {
            const deltaX = node.position.x - oldFolder.x
            const deltaY = node.position.y - oldFolder.y
            
            // Find all files that belong to this folder
            const childFiles = fileRecords.filter(f => f.parentFolder === folderId)
            
            // Update each child file's absolute position
            for (const child of childFiles) {
              try {
                const newAbsoluteX = child.x + deltaX
                const newAbsoluteY = child.y + deltaY
                await FileAPI.updateFilePosition(child.id, newAbsoluteX, newAbsoluteY)
              } catch (error) {
                console.error(`Failed to update child file ${child.id}:`, error)
              }
            }
          }
          
          await refreshMetadata()
        } catch (error) {
          console.error("Failed to update folder:", error)
          toast.error("Failed to update folder")
        }
      }
      if (node.type === "genericNode") {
        setCustomGenericNodes((prev) =>
          prev.map((generic) =>
            generic.id === node.id
              ? {
                  ...generic,
                  position: node.position,
                }
              : generic,
          ),
        )
      }
    },
    [folderRecords, metadataRecords, refreshMetadata],
  )

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      const nodeId = params.nodes?.[0]?.id ?? null
      setSelectedNodeId(nodeId)
      onSelectNode(nodeId)
      
      // Track selected edges
      const edgeIds = params.edges?.map(e => e.id) || []
      setSelectedEdges(edgeIds)
    },
    [onSelectNode, setSelectedEdges],
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
    onSelectNode(null)
  }, [onSelectNode])

  // Handle keyboard events for deleting edges
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Delete" && selectedEdges.length > 0) {
        const edgesToDelete = selectedEdges
          .map(id => flowEdges.find(e => e.id === id))
          .filter((edge): edge is Edge => edge !== undefined)
        
        if (edgesToDelete.length > 0) {
          handleEdgesDelete(edgesToDelete)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedEdges, flowEdges, handleEdgesDelete])

  const defaultEdgeOptions = useMemo(
    () => ({
      type: "smoothstep" as const,
      animated: false,
      deletable: true,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { 
        strokeWidth: 2,
        pointerEvents: "stroke" as React.CSSProperties["pointerEvents"],
        cursor: "pointer"
      },
      zIndex: 1000,
    }),
    [],
  )

  const openCreateFileModal = useCallback((position?: { x: number; y: number }) => {
    setPendingFilePosition(position ?? defaultFilePosition())
    setShowFileModal(true)
  }, [defaultFilePosition])

  const openCreateFolderModal = useCallback((position?: { x: number; y: number }) => {
    setPendingFolderPosition(position ?? defaultFilePosition())
    setShowFolderModal(true)
  }, [defaultFilePosition])

  const handleNodeConfigure = useCallback(
    async (config: NodeConfiguration) => {
      if (!pendingNodeConfig) return

      const { type, position, label: initialLabel, template, categoryLabel } = pendingNodeConfig
      const genericId = `generic-${Date.now()}`
      const finalLabel = config.label || initialLabel || `${type} node`
      // Use categoryLabel from template, fallback to config.category, then default
      const resolvedCategory = categoryLabel || config.category || (template ? "Files" : "Custom")

      if (type === "file") {
        // Create a file node
        try {
          const fileX = position.x - NODE_WIDTH / 2
          const fileY = position.y - NODE_HEIGHT / 4
          const candidateName = (config.fileName || "").trim() || template?.defaultFileName || ""
          if (!candidateName) {
            toast.error("Please provide a file name")
            return
          }
          const filePath = candidateName.replace(/^\/+/, "")
          const fileType = config.fileType || template?.fileType || "python"
          const description = config.description || template?.description || ""

          const result = await FileAPI.createFile({
            filePath,
            fileType,
            content: template?.content ?? "",
            description,
            category: resolvedCategory,
          })

          if (!result.success || !result.data) {
            throw new Error(result.error || "Failed to create file")
          }
          
          // Update position
          await FileAPI.updateFilePosition(result.data.id, fileX, fileY)
          
          // Refresh data
          const [files, metadata] = await Promise.all([
            FileAPI.getFiles(),
            FileAPI.getMetadata(),
          ])
          setFileRecords(files)
          setMetadataRecords(metadata)
          setSelectedNodeId(result.data.id)
          onSelectNode(result.data.id)
          toast.success("File node created successfully")
        } catch (error) {
          console.error("Failed to create file node:", error)
          toast.error("Failed to create file node")
        }
      } else if (type === "folder") {
        // Create a folder node
        try {
          const width = 640
          const height = 420
          const folderX = position.x - width / 2
          const folderY = position.y - FOLDER_HEADER_HEIGHT / 2

          const created = await FileAPI.createFolder(finalLabel, folderX, folderY, width, height)
          const [folders, metadata] = await Promise.all([
            FileAPI.getFolders(),
            FileAPI.getMetadata(),
          ])
          setFolderRecords(folders)
          setMetadataRecords(metadata)
          setSelectedNodeId(created.id)
          onSelectNode(created.id)
          toast.success("Folder node created successfully")
        } catch (error) {
          console.error("Failed to create folder node:", error)
          toast.error("Failed to create folder node")
        }
      } else {
        // Create a generic node
        const genericNode: Node<GenericNodeData> = {
          id: genericId,
          type: "genericNode",
          position: {
            x: position.x - 110,
            y: position.y - 80,
          },
          data: {
            kind: "generic",
            label: finalLabel,
            category: resolvedCategory,
          },
          draggable: true,
          selectable: true,
          connectable: true,
          style: { zIndex: 2 },
        }

        setCustomGenericNodes((prev) => [...prev, genericNode])
        setSelectedNodeId(genericId)
        onSelectNode(genericId)
        toast.success("Generic node created successfully")
      }

      // Reset pending config
      setPendingNodeConfig(null)
      setShowNodeConfigModal(false)
    },
    [pendingNodeConfig, onSelectNode, setShowNodeConfigModal],
  )

  // Listen for custom events to show modals
  useEffect(() => {
    const handleCreateFile = () => {
      openCreateFileModal()
    }
    
    const handleCreateFolder = () => {
      openCreateFolderModal()
    }
    
    window.addEventListener('create-file', handleCreateFile)
    window.addEventListener('create-folder', handleCreateFolder)
    
    return () => {
      window.removeEventListener('create-file', handleCreateFile)
      window.removeEventListener('create-folder', handleCreateFolder)
    }
  }, [openCreateFileModal, openCreateFolderModal])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const handleNodeExpand = useCallback((nodeId: string) => {
    setExpandedNode(expandedNode === nodeId ? null : nodeId)
  }, [expandedNode])
  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()

      const payloadRaw = event.dataTransfer.getData("application/json")
      let payload: SidebarDragPayload | null = null
      if (payloadRaw) {
        try {
          payload = JSON.parse(payloadRaw)
        } catch {
          payload = null
        }
      }

      const typeRaw = event.dataTransfer.getData("application/reactflow")
      if (!payload && typeRaw) {
        payload = { type: typeRaw }
      }
      if (!payload) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      if (payload.type === "file" && payload.isSpecial) {
        openCreateFileModal({
          x: position.x - NODE_WIDTH / 2,
          y: position.y - NODE_HEIGHT / 4,
        })
        return
      }

      if (payload.type === "folder" && payload.isSpecial) {
        setPendingFolderPosition({
          x: position.x,
          y: position.y,
        })
        setShowFolderModal(true)
        return
      }

      // For all other node types, show the configuration modal
      setPendingNodeConfig({
        type: payload.template ? "file" : payload.type || "custom",
        position: {
          x: position.x,
          y: position.y,
        },
        label: payload.label,
        template: payload.template ?? undefined,
        categoryLabel: payload.categoryLabel,
        initialValues: payload.template
          ? {
              label: payload.label,
              description: payload.template.description,
              fileName: payload.template.defaultFileName,
              fileType: payload.template.fileType,
              category: payload.categoryLabel || "File",
            }
          : undefined,
      })
      setShowNodeConfigModal(true)
    },
    [openCreateFileModal, screenToFlowPosition],
  )


  return (
    <div className="relative h-full w-full">
      {loading ? (
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary/40 border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Loading workspace…</p>
          </div>
        </div>
      ) : (
        <div className="h-full w-full">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgesDelete={handleEdgesDelete}
            onNodesDelete={handleNodesDelete}
            onConnect={handleConnect}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            onSelectionChange={handleSelectionChange}
            onPaneClick={handlePaneClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            fitView
            minZoom={0.2}
            maxZoom={2.5}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            className="bg-background canvas-flow"
            connectionMode={ConnectionMode.Loose}
            connectOnClick
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Lines} gap={20} lineWidth={1} color="var(--border)" />
          </ReactFlow>
        </div>
      )}

      {editorNodeId && (() => {
        const record = fileRecords.find((file) => file.id === editorNodeId)
        if (!record) return null
        return (
          <CodeEditor
            content={record.content || ""}
            fileType={record.fileType || "text"}
            fileName={record.filePath || record.label}
            onSave={(content) => handleFileSave(record.id, content)}
            onClose={() => setEditorNodeId(null)}
            isModified={record.isModified}
          />
        )
      })()}


      {/* File Naming Modal */}
      <FileNamingModal
        isOpen={showFileModal}
        onClose={() => {
          setShowFileModal(false)
          setPendingFileDrop(null)
        }}
        onCreateFile={handleFileCreate}
      />

      {/* Code Editor Modal */}
      {expandedNode && (() => {
        const node = fileRecords.find(n => n.id === expandedNode)
        if (!node) return null
        
        return (
          <CodeEditor
            content={node.content || ''}
            fileType={node.fileType || 'text'}
            fileName={node.filePath || node.label}
            onSave={(content) => handleFileSave(node.id, content)}
            onClose={() => setExpandedNode(null)}
            isModified={node.isModified}
          />
        )
      })()}

      <FileNamingModal
        isOpen={showFileModal}
        onClose={() => setShowFileModal(false)}
        onCreateFile={handleFileCreate}
      />

      <FolderNamingModal
        isOpen={showFolderModal}
        onClose={() => {
          setShowFolderModal(false)
          setPendingFolderPosition(null)
        }}
        onCreateFolder={handleFolderCreate}
        position={pendingFolderPosition || undefined}
      />

      <EdgeCreationModal
        isOpen={!!pendingEdge}
        onClose={() => setPendingEdge(null)}
        onCreateEdge={handleEdgeCreate}
        fromNodeId={pendingEdge?.from || ""}
        toNodeId={pendingEdge?.to || ""}
      />

      <NodeConfigurationModal
        isOpen={showNodeConfigModal}
        onClose={() => {
          setShowNodeConfigModal(false)
          setPendingNodeConfig(null)
        }}
        onConfigure={handleNodeConfigure}
        nodeType={pendingNodeConfig?.type || "custom"}
        initialPosition={pendingNodeConfig?.position}
        initialValues={pendingNodeConfig?.initialValues}
      />
    </div>
  )
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
