"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  OnEdgesDelete,
  OnSelectionChangeParams,
  useEdgesState,
  useNodesState,
  NodeChange,
} from "reactflow"
import "reactflow/dist/style.css"
import type React from "react"
import { toast } from "sonner"
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
import {
  FileNodeComponent,
  FolderNodeComponent,
  GenericNodeComponent,
  type FileNodeData,
  type FolderNodeData,
  type GenericNodeData,
} from "./canvas/node-components"
import { useCanvasData, useModalState } from "./canvas/hooks"
import { NODE_WIDTH, NODE_HEIGHT, FOLDER_HEADER_HEIGHT, FOLDER_COLLAPSED_HEIGHT } from "./canvas/utils"
import type { NodeTypes } from "reactflow"

interface CanvasProps {
  selectedNode: string | null
  onSelectNode: (id: string | null) => void
  onNodeDrop?: (nodeData: any, position: { x: number; y: number }) => void
  onDataChange?: (nodes: ApiFileNode[], metadata: Record<string, NodeMetadata>) => void
  onMetadataUpdate?: (metadata: Record<string, NodeMetadata>) => void
  isRunning?: boolean
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

const nodeTypes = {
  fileNode: FileNodeComponent,
  folderNode: FolderNodeComponent,
  genericNode: GenericNodeComponent,
} satisfies NodeTypes

const isFileNodeData = (data: CanvasNodeData): data is FileNodeData => data.kind === "file"

function CanvasInner({ selectedNode, onSelectNode, onDataChange, onMetadataUpdate, isRunning }: CanvasProps) {
  const [flowNodes, setFlowNodes, onNodesChangeBase] = useNodesState([])
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge[]>([])
  const [selectedEdges, setSelectedEdges] = useState<string[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(selectedNode)
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null)
  const [customGenericNodes, setCustomGenericNodes] = useState<Node<GenericNodeData>[]>([])
  const [pendingEdge, setPendingEdge] = useState<{ from: string; to: string } | null>(null)
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null)
  const [runningNodeIds, setRunningNodeIds] = useState<Set<string>>(new Set())
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null)
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map())

  // Use extracted hooks
  const { fileRecords, folderRecords, metadataRecords, edgeRecords, loading, refreshMetadata } = useCanvasData(
    onDataChange,
    onMetadataUpdate
  )

  const {
    showFileModal,
    showFolderModal,
    showNodeConfigModal,
    pendingFilePosition,
    pendingFolderPosition,
    pendingNodeConfig,
    setShowFileModal,
    setShowFolderModal,
    setShowNodeConfigModal,
    setPendingFilePosition,
    setPendingFolderPosition,
    setPendingNodeConfig,
    openCreateFileModal,
    openCreateFolderModal,
  } = useModalState()

  const { screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    setSelectedNodeId(selectedNode)
  }, [selectedNode])

  // Poll file statuses to keep running state in sync
  useEffect(() => {
    const checkRunningFiles = async () => {
      if (fileRecords.length === 0) return
      
      const statusChecks = fileRecords.map(file => FileAPI.getFileStatus(file.id))
      const statuses = await Promise.all(statusChecks)
      
      const newRunningIds = new Set<string>()
      statuses.forEach((status, index) => {
        if (status.running) {
          newRunningIds.add(fileRecords[index].id)
        }
      })
      
      setRunningNodeIds(prev => {
        const prevArray = Array.from(prev).sort()
        const newArray = Array.from(newRunningIds).sort()
        if (JSON.stringify(prevArray) !== JSON.stringify(newArray)) {
          return newRunningIds
        }
        return prev
      })
    }
    
    checkRunningFiles()
    const interval = setInterval(checkRunningFiles, 2000)
    
    return () => {
      clearInterval(interval)
      eventSourcesRef.current.forEach(eventSource => eventSource.close())
      eventSourcesRef.current.clear()
    }
  }, [fileRecords])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChangeBase(changes)
    
    for (const change of changes) {
      if (change.type === 'dimensions' && change.dimensions) {
        const node = flowNodes.find(n => n.id === change.id)
        if (node?.type === 'folderNode') {
          const { width, height } = change.dimensions
          
          setFlowNodes(prevNodes => 
            prevNodes.map(n => 
              n.id === change.id 
                ? { ...n, style: { ...n.style, width, height } }
                : n
            )
          )
          
          if (width && height) {
            setTimeout(() => {
              FileAPI.updateFolder(change.id, { width, height }).catch(console.error)
            }, 100)
          }
        }
      }
    }
  }, [onNodesChangeBase, flowNodes, setFlowNodes])

  const openEditor = useCallback((id: string) => setEditorNodeId(id), [])
  const handleFileDelete = useCallback(async (id: string) => {
    const file = fileRecords.find((record) => record.id === id)
    const confirmed = typeof window === "undefined" || window.confirm(`Delete ${file?.label ?? "this file"} from the canvas?`)
    if (!confirmed) return

    try {
      await FileAPI.deleteFile(id)
      toast.success("File deleted")
    } catch (error) {
      console.error("Failed to delete file:", error)
      toast.error("Failed to delete file")
    }
  }, [fileRecords])

  const handleFolderDelete = useCallback(async (id: string) => {
    const folder = folderRecords.find((record) => record.id === id)
    const containedFileCount = folder?.containedFiles?.length || 0
    const confirmMessage = containedFileCount > 0
      ? `Delete "${folder?.name ?? "this folder"}" and all ${containedFileCount} file(s) inside?`
      : `Delete "${folder?.name ?? "this folder"}"?`
    
    const confirmed = typeof window === "undefined" || window.confirm(confirmMessage)
    if (!confirmed) return

    try {
      await FileAPI.deleteFolder(id)
      toast.success("Folder deleted")
    } catch (error) {
      console.error("Failed to delete folder:", error)
      toast.error("Failed to delete folder")
    }
  }, [folderRecords])

  const handleGenerateCode = useCallback(async (id: string) => {
    setGeneratingNodeId(id)
    try {
      const result = await FileAPI.generateFileCode(id)
      if (result.success) {
        toast.success("Code generated successfully")
      } else {
        toast.error("Failed to generate code")
      }
    } catch (error) {
      console.error("Failed to generate code:", error)
      toast.error("Failed to generate code")
    } finally {
      setGeneratingNodeId(null)
    }
  }, [])

  const handleRunFile = useCallback(async (id: string) => {
    setRunningNodeIds(prev => new Set(prev).add(id))
    
    try {
      const fileRecord = fileRecords.find(f => f.id === id)
      if (fileRecord && fileRecord.filePath && fileRecord.fileType) {
        let command = ""
        if (fileRecord.fileType === "python") {
          command = `python ${fileRecord.filePath}`
        } else if (fileRecord.fileType === "javascript") {
          command = `node ${fileRecord.filePath}`
        } else {
          command = fileRecord.filePath
        }
        
        if ((window as any).addTerminalCommand) {
          (window as any).addTerminalCommand(command)
        }
      }
      
      const result = await FileAPI.runFile(
        id,
        (output) => {
          const addTerminalOutput = (window as any).addTerminalOutput
          if (addTerminalOutput && typeof addTerminalOutput === 'function') {
            addTerminalOutput(output)
          }
        },
        (success, returnCode) => {
          if (success) {
            toast.success(`File executed successfully`)
          } else {
            toast.error(`File execution failed (exit code: ${returnCode})`)
          }
          setRunningNodeIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(id)
            return newSet
          })
          const eventSource = eventSourcesRef.current.get(id)
          if (eventSource) {
            eventSource.close()
            eventSourcesRef.current.delete(id)
          }
        }
      )
      
      if (!result.success) {
        toast.error(`Failed to start file: ${result.error}`)
        setRunningNodeIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
      } else {
        toast.info(`File started - check terminal for output`)
        if (result.eventSource) {
          eventSourcesRef.current.set(id, result.eventSource)
        }
      }
    } catch (error) {
      console.error("Failed to run file:", error)
      toast.error("Failed to run file")
      setRunningNodeIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }, [fileRecords])

  const handleStopFile = useCallback(async (id: string) => {
    try {
      toast.info("Stopping file...")
      
      const eventSource = eventSourcesRef.current.get(id)
      if (eventSource) {
        eventSource.close()
        eventSourcesRef.current.delete(id)
      }
      
      const result = await FileAPI.stopFile(id)
      if (result.success) {
        toast.success(`File stopped successfully`)
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
  }, [])

  const handleFileSave = useCallback(async (nodeId: string, content: string) => {
    try {
      await FileAPI.updateFileContent(nodeId, content)
    } catch (error) {
      console.error("Failed to save file:", error)
      throw error
    }
  }, [])

  const defaultFilePosition = useCallback((): { x: number; y: number } => {
    const offset = (fileRecords.length + folderRecords.length) * 40
    return { x: 160 + offset, y: 160 + offset }
  }, [fileRecords.length, folderRecords.length])

  const handleFileCreate = useCallback(async (fileName: string, fileType: string, description?: string, category?: string) => {
    try {
      const result = await FileAPI.createFile({
        filePath: fileName,
        fileType,
        content: "",
        description: description ?? "",
        category: category || "Files",
      })

      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to create file")
        return
      }

      const position = pendingFilePosition ?? defaultFilePosition()
      await FileAPI.updateFilePosition(result.data.id, position.x, position.y)
      toast.success("File created")
    } catch (error) {
      console.error("Failed to create file:", error)
      toast.error("Failed to create file")
    } finally {
      setPendingFilePosition(null)
    }
  }, [defaultFilePosition, pendingFilePosition])

  const handleFolderCreate = useCallback(async (folderName: string) => {
    if (!pendingFolderPosition) return

    try {
      const width = 640
      const height = 420
      const folderX = pendingFolderPosition.x - width / 2
      const folderY = pendingFolderPosition.y - FOLDER_HEADER_HEIGHT / 2

      const created = await FileAPI.createFolder(folderName, folderX, folderY, width, height)
      setSelectedNodeId(created.id)
      onSelectNode(created.id)
      toast.success("Folder created successfully")
    } catch (error) {
      console.error("Failed to create folder:", error)
      toast.error("Failed to create folder")
    } finally {
      setPendingFolderPosition(null)
    }
  }, [pendingFolderPosition, onSelectNode])

  const rebuildNodes = useCallback((): Node<CanvasNodeData>[] => {
    const nodes: Node<CanvasNodeData>[] = []

    for (const record of fileRecords) {
      const meta = metadataRecords[record.id]
      let position = meta ? { x: meta.x ?? 120, y: meta.y ?? 120 } : { x: 120, y: 120 }
      
      if (record.parentFolder) {
        const parentFolder = folderRecords.find(f => f.id === record.parentFolder)
        if (parentFolder) {
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
          isRunning: isRunning || false,
          description: meta?.description,
          category: record.category || meta?.category,
          onOpen: openEditor,
          onGenerate: handleGenerateCode,
          onRun: handleRunFile,
          onStop: handleStopFile,
          onDelete: handleFileDelete,
        },
        style: { width: NODE_WIDTH, zIndex: 10 },
        draggable: true,
        selectable: true,
        connectable: true,
        parentId: record.parentFolder ?? undefined,
      })
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
          isRunning: isRunning || false,
          onDelete: handleFolderDelete,
        },
        draggable: true,
        selectable: true,
        style: { width: folder.width, height, zIndex: 1 },
        connectable: true,
      })
    }

    for (const generic of customGenericNodes) {
      nodes.push({
        ...generic,
        data: {
          ...generic.data,
          isRunning: isRunning || false,
        }
      })
    }

    const selection = selectedNodeId ?? null
    return nodes.map((node) => ({
      ...node,
      selected: selection !== null && node.id === selection,
    }))
  }, [
    fileRecords, folderRecords, metadataRecords, generatingNodeId, runningNodeIds, isRunning,
    handleFileDelete, handleGenerateCode, handleRunFile, handleStopFile, openEditor,
    customGenericNodes, selectedNodeId, hoveredFolderId, handleFolderDelete
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
        animated: isRunning, // Enable edge animation when canvas is running
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: isRunning ? "#a855f7" : "#ffffff" },
        style: {
          pointerEvents: "stroke" as React.CSSProperties["pointerEvents"],
          cursor: "pointer",
          stroke: isRunning ? "#a855f7" : "#ffffff",
          strokeWidth: 2.5,
          filter: isRunning ? 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))' : 'none',
        },
        zIndex: 1000,
      }
    })
  }, [edgeRecords, isRunning])

  useEffect(() => {
    setFlowNodes(rebuildNodes())
  }, [rebuildNodes, setFlowNodes])

  useEffect(() => {
    setFlowEdges(rebuildEdges())
  }, [rebuildEdges, setFlowEdges])

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return
    
    const duplicateEdge = edgeRecords.some(
      (edge) => edge.from === connection.source && edge.to === connection.target,
    )
    if (duplicateEdge) {
      toast("Those nodes are already connected")
      return
    }
    setPendingEdge({ from: connection.source, to: connection.target })
  }, [edgeRecords])

  const handleEdgeCreate = useCallback(async (edgeData: { type: string; description?: string }) => {
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
      toast.success("Edge created")
    } catch (error) {
      console.error("Failed to create edge:", error)
      toast.error("Failed to create edge")
    } finally {
      setPendingEdge(null)
    }
  }, [edgeRecords, pendingEdge])

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
  }, [])

  const handleNodesDelete = useCallback(async (nodes: any[]) => {
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
  }, [handleFileDelete])

  const handleNodeDrag = useCallback((_event: React.MouseEvent, node: Node<CanvasNodeData>) => {
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

      setHoveredFolderId(containingFolder ? containingFolder.id : null)
    }
  }, [folderRecords])

  const handleNodeDragStop = useCallback(async (_event: React.MouseEvent, node: Node<CanvasNodeData>) => {
    setHoveredFolderId(null)
    
    if (node.type === "fileNode" && isFileNodeData(node.data)) {
      const fileId = node.id
      let { x, y } = node.position
      const fileData = node.data as FileNodeData

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
        const oldFolder = folderRecords.find(f => f.id === folderId)
        const updates: any = { x: node.position.x, y: node.position.y }
        if (node.style?.width) updates.width = node.style.width
        if (node.style?.height) updates.height = node.style.height
        await FileAPI.updateFolder(folderId, updates)
        
        if (oldFolder) {
          const deltaX = node.position.x - oldFolder.x
          const deltaY = node.position.y - oldFolder.y
          const childFiles = fileRecords.filter(f => f.parentFolder === folderId)
          
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
          generic.id === node.id ? { ...generic, position: node.position } : generic
        )
      )
    }
  }, [folderRecords, fileRecords, refreshMetadata])

  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const nodeId = params.nodes?.[0]?.id ?? null
    setSelectedNodeId(nodeId)
    onSelectNode(nodeId)
    
    const edgeIds = params.edges?.map(e => e.id) || []
    setSelectedEdges(edgeIds)
  }, [onSelectNode])

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
    onSelectNode(null)
  }, [onSelectNode])

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

  const defaultEdgeOptions = useMemo(() => ({
    type: "smoothstep" as const,
    animated: isRunning, // Only animate when canvas is running
    deletable: true,
    markerEnd: { 
      type: MarkerType.ArrowClosed, 
      width: 20, 
      height: 20,
      color: isRunning ? '#a855f7' : '#ffffff'
    },
    style: { 
      strokeWidth: 2.5,
      pointerEvents: "stroke" as React.CSSProperties["pointerEvents"],
      cursor: "pointer",
      stroke: isRunning ? '#a855f7' : '#ffffff',
      filter: isRunning ? 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))' : 'none',
    },
    zIndex: 1000,
    pathOptions: {
      offset: 0,
      borderRadius: 8,
    },
  }), [isRunning])

  const handleNodeConfigure = useCallback(async (config: NodeConfiguration) => {
    if (!pendingNodeConfig) return

    const { type, position, label: initialLabel, template, categoryLabel } = pendingNodeConfig
    const finalLabel = config.label || initialLabel || `${type} node`
    // Default to "Files" category for file nodes, "Custom" for other node types
    const resolvedCategory = categoryLabel || config.category || (type === "file" ? "Files" : "Custom")

    if (type === "file") {
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
          filePath, fileType, content: template?.content ?? "", description, category: resolvedCategory,
        })

        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to create file")
        }
        
        await FileAPI.updateFilePosition(result.data.id, fileX, fileY)
        setSelectedNodeId(result.data.id)
        onSelectNode(result.data.id)
        toast.success("File node created successfully")
      } catch (error) {
        console.error("Failed to create file node:", error)
        toast.error("Failed to create file node")
      }
    } else if (type === "folder") {
      try {
        const width = 640, height = 420
        const folderX = position.x - width / 2
        const folderY = position.y - FOLDER_HEADER_HEIGHT / 2

        const created = await FileAPI.createFolder(finalLabel, folderX, folderY, width, height)
        setSelectedNodeId(created.id)
        onSelectNode(created.id)
        toast.success("Folder node created successfully")
      } catch (error) {
        console.error("Failed to create folder node:", error)
        toast.error("Failed to create folder node")
      }
    } else {
      const genericId = `generic-${Date.now()}`
      const genericNode: Node<GenericNodeData> = {
        id: genericId,
        type: "genericNode",
        position: { x: position.x - 110, y: position.y - 80 },
        data: { kind: "generic", label: finalLabel, category: resolvedCategory },
        draggable: true, selectable: true, connectable: true, style: { zIndex: 10 },
      }

      setCustomGenericNodes((prev) => [...prev, genericNode])
      setSelectedNodeId(genericId)
      onSelectNode(genericId)
      toast.success("Generic node created successfully")
    }

    setPendingNodeConfig(null)
    setShowNodeConfigModal(false)
  }, [pendingNodeConfig, onSelectNode])

  useEffect(() => {
    const handleCreateFile = () => openCreateFileModal()
    const handleCreateFolder = () => openCreateFolderModal()
    
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

  const handleDrop = useCallback(async (event: React.DragEvent) => {
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
      setPendingFolderPosition({ x: position.x, y: position.y })
      setShowFolderModal(true)
      return
    }

    setPendingNodeConfig({
      type: payload.template ? "file" : payload.type || "custom",
      position: { x: position.x, y: position.y },
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
  }, [openCreateFileModal, screenToFlowPosition])

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

      <FileNamingModal
        isOpen={showFileModal}
        onClose={() => {
          setShowFileModal(false)
          setPendingFilePosition(null)
        }}
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

