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
import {
  FileAPI,
  FileNode as ApiFileNode,
  FolderNode as ApiFolderNode,
  NodeMetadata,
} from "@/lib/api"
import { toast } from "sonner"
import { FileText, Folder as FolderIcon, Sparkles, Trash2 } from "lucide-react"

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
  description?: string
  onOpen: (id: string) => void
  onGenerate: (id: string) => void
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

const isFileNodeData = (data: CanvasNodeData): data is FileNodeData => data.kind === "file"

const FileNodeComponent = memo(({ id, data, selected, isConnectable }: NodeProps<FileNodeData>) => {
  const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1)
  const hasExistingContent = Boolean(data.content && data.content.trim().length > 0)

  return (
    <div
      className={`relative rounded-2xl border bg-card/90 shadow-lg transition-all ${
        selected ? "ring-2 ring-primary/60 border-primary/40" : "border-border/40"
      }`}
      style={{ width: NODE_WIDTH }}
    >
      <NodeHandles isConnectable={isConnectable} />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
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
            <Sparkles className="h-4 w-4 animate-spin text-primary" />
          ) : null}
        </div>

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
          {!hasExistingContent && data.description && data.description.trim() && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-primary"
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

  return (
    <div
      className={`relative rounded-2xl border-2 bg-primary/10 backdrop-blur-sm transition-all ${
        selected ? "border-primary/60" : "border-primary/30"
      }`}
      style={{ width: data.width, height }}
    >
      <NodeResizer
        color="#ff0071"
        isVisible={selected}
        minWidth={300}
        minHeight={200}
        handleStyle={{
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          backgroundColor: '#ff0071',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
        lineStyle={{
          borderColor: '#ff0071',
          borderWidth: '2px',
        }}
      />
      <NodeHandles isConnectable={isConnectable} />
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-primary/30 bg-primary/15 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
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
  return (
    <div
      className={`relative rounded-2xl border bg-card/90 px-4 py-3 shadow-md transition-all ${
        selected ? "ring-2 ring-primary/50 border-primary/30" : "border-border/30"
      }`}
      style={{ width: 220 }}
    >
      <NodeHandles isConnectable={isConnectable} />
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{data.category}</p>
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
  const [fileRecords, setFileRecords] = useState<ApiFileNode[]>([])
  const [metadataRecords, setMetadataRecords] = useState<Record<string, NodeMetadata>>({})
  const [folderRecords, setFolderRecords] = useState<ApiFolderNode[]>([])
  const [edgeRecords, setEdgeRecords] = useState<EdgeRecord[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(selectedNode)
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null)
  const [customGenericNodes, setCustomGenericNodes] = useState<Node<GenericNodeData>[]>([])
  const [showFileModal, setShowFileModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [pendingFilePosition, setPendingFilePosition] = useState<{ x: number; y: number } | null>(null)
  const [pendingFolderPosition, setPendingFolderPosition] = useState<{ x: number; y: number } | null>(null)

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
  const [expandedNode, setExpandedNode] = useState<string | null>(null)
  const [pendingFileDrop, setPendingFileDrop] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshInFlight = useRef(false)
  const { screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    setSelectedNodeId(selectedNode)
  }, [selectedNode])

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
      const position = meta ? { x: meta.x ?? 120, y: meta.y ?? 120 } : { x: 120, y: 120 }
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
          description: meta?.description,
          onOpen: openEditor,
          onGenerate: handleGenerateCode,
          onDelete: handleFileDelete,
        },
        style: { width: NODE_WIDTH, zIndex: 2 },
        draggable: true,
        selectable: true,
        connectable: true,
        parentId: record.parentFolder ?? undefined,
        extent: record.parentFolder ? "parent" : undefined,
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
    handleFileDelete,
    handleGenerateCode,
    openEditor,
    customGenericNodes,
    selectedNodeId,
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

  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node<CanvasNodeData>) => {
      if (node.type === "fileNode" && isFileNodeData(node.data)) {
        const fileId = node.id
        const { x, y } = node.position

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
        const currentParent = node.data.parentFolder

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
          // Update folder position and dimensions if resized
          const updates: any = { x: node.position.x, y: node.position.y }
          if (node.style?.width) {
            updates.width = node.style.width
          }
          if (node.style?.height) {
            updates.height = node.style.height
          }
          await FileAPI.updateFolder(folderId, updates)
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
    },
    [onSelectNode],
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
    onSelectNode(null)
  }, [onSelectNode])

  const defaultEdgeOptions = useMemo(
    () => ({
      type: "smoothstep" as const,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { strokeWidth: 2 },
    }),
    [],
  )

  const openCreateFileModal = useCallback((position?: { x: number; y: number }) => {
    setPendingFilePosition(position ?? defaultFilePosition())
    setShowFileModal(true)
  }, [defaultFilePosition])

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
      let payload: { type?: string; isSpecial?: boolean; label?: string } | null = null
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

      const genericId = `generic-${Date.now()}`
      const label = payload.label || `${payload.type ?? "custom"} node`
      const category = payload.type || "custom"

      const genericNode: Node<GenericNodeData> = {
        id: genericId,
        type: "genericNode",
        position: {
          x: position.x - 110,
          y: position.y - 80,
        },
        data: {
          kind: "generic",
          label,
          category,
        },
        draggable: true,
        selectable: true,
        connectable: true,
        style: { zIndex: 2 },
      }

      setCustomGenericNodes((prev) => [...prev, genericNode])
      setSelectedNodeId(genericId)
      onSelectNode(genericId)
    },
    [onSelectNode, openCreateFileModal, screenToFlowPosition],
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
            className="bg-background"
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












