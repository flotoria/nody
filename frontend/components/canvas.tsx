"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { ZoomIn, ZoomOut, Maximize2, Link } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Node } from "@/components/node"
import { CodeEditor } from "@/components/code-editor"
import { FileNamingModal } from "@/components/file-naming-modal"
import { EdgeCreationModal } from "@/components/edge-creation-modal"
import { FileAPI, FileNode, NodeMetadata, FolderNode } from "@/lib/api"
import { toast } from "sonner"

interface CanvasProps {
  selectedNode: string | null
  onSelectNode: (id: string | null) => void
  onNodeDrop?: (nodeData: any, position: { x: number; y: number }) => void
  onDataChange?: (nodes: FileNode[], metadata: Record<string, NodeMetadata>) => void
}

interface NodeData {
  id: string
  type: string
  label: string
  x: number
  y: number
  status: "idle" | "running" | "success" | "failed"
  // File-specific properties
  filePath?: string
  fileType?: string
  content?: string
  isExpanded?: boolean
  isModified?: boolean
}

interface Edge {
  id: string
  from: string
  to: string
  fromPort?: string
  toPort?: string
  type?: string
  description?: string
}

const initialNodes: NodeData[] = [
  { id: "1", type: "file", label: "main.py", x: 100, y: 100, status: "idle", filePath: "main.py", fileType: "python", content: "# FastAPI main file\nfrom fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get(\"/\")\ndef read_root():\n    return {\"Hello\": \"World\"}", isExpanded: false, isModified: false },
  { id: "2", type: "file", label: "models.py", x: 350, y: 100, status: "idle", filePath: "models.py", fileType: "python", content: "# Data models\nfrom pydantic import BaseModel\n\nclass User(BaseModel):\n    id: int\n    name: str\n    email: str", isExpanded: false, isModified: false },
  { id: "3", type: "file", label: "config.py", x: 600, y: 100, status: "idle", filePath: "config.py", fileType: "python", content: "# Configuration\nimport os\n\nDATABASE_URL = os.getenv(\"DATABASE_URL\", \"sqlite:///./app.db\")\nDEBUG = os.getenv(\"DEBUG\", \"False\").lower() == \"true\"", isExpanded: false, isModified: false },
]

// Edge type display mapping
const edgeTypeDisplay: Record<string, string> = {
  'depends_on': 'depends on',
  'uses': 'uses',
  'imports': 'imports',
  'calls': 'calls',
  'extends': 'extends',
  'implements': 'implements',
  'references': 'references'
}

const initialEdges: Edge[] = [
  { id: "e1-2", from: "1", to: "2" },
  { id: "e2-3", from: "2", to: "3" },
]

export function Canvas({ selectedNode, onSelectNode, onDataChange }: CanvasProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [nodes, setNodes] = useState<NodeData[]>([])
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [tempEdge, setTempEdge] = useState<{ x: number; y: number } | null>(null)
  const [expandedNode, setExpandedNode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFileModal, setShowFileModal] = useState(false)
  const [pendingFileDrop, setPendingFileDrop] = useState<{ x: number; y: number } | null>(null)
  const [metadata, setMetadata] = useState<Record<string, NodeMetadata>>({})
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null)
  
  // Edge drawing mode state
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const [drawingSourceNode, setDrawingSourceNode] = useState<string | null>(null)
  const [showEdgeModal, setShowEdgeModal] = useState(false)
  const [pendingEdge, setPendingEdge] = useState<{ from: string; to: string } | null>(null)
  const [edgeToDelete, setEdgeToDelete] = useState<{ from: string; to: string; type: string } | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)

  // Load files, folders, metadata, and edges from API on component mount
  useEffect(() => {
    const loadData = async () => {
      console.log('Canvas: Starting to load data from API')
      try {
        console.log('Canvas: Calling FileAPI.getFiles(), FileAPI.getFolders(), FileAPI.getMetadata(), and FileAPI.getEdges()')
        const [files, foldersData, metadataData, edgesData] = await Promise.all([
          FileAPI.getFiles(),
          FileAPI.getFolders(),
          FileAPI.getMetadata(),
          FileAPI.getEdges()
        ])
        console.log('Canvas: Got files:', files)
        console.log('Canvas: Got folders:', foldersData)
        console.log('Canvas: Got metadata:', metadataData)
        console.log('Canvas: Got edges:', edgesData)
        setNodes(files as NodeData[])
        setFolders(foldersData)
        setMetadata(metadataData)
        setEdges(edgesData.map((edge: any, index: number) => ({
          id: `e${edge.from}-${edge.to}`,
          from: edge.from,
          to: edge.to,
          type: edge.type,
          description: edge.description
        })))
        setLoading(false)
        console.log('Canvas: Data loading completed successfully')
      } catch (error) {
        console.error('Canvas: Failed to load data:', error)
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Notify parent when data changes
  useEffect(() => {
    if (onDataChange && !loading) {
      onDataChange(nodes, metadata)
    }
  }, [nodes, metadata, loading, onDataChange])

  // Handle node selection (normal mode) or edge drawing (drawing mode)
  const handleNodeSelect = useCallback((nodeId: string) => {
    if (isDrawingMode) {
      if (!drawingSourceNode) {
        // First node selected - set as source
        setDrawingSourceNode(nodeId)
      } else if (drawingSourceNode === nodeId) {
        // Same node clicked - cancel selection
        setDrawingSourceNode(null)
      } else {
        // Second node selected - create edge
        setPendingEdge({ from: drawingSourceNode, to: nodeId })
        setShowEdgeModal(true)
        setDrawingSourceNode(null)
      }
    } else {
      // Normal mode - select node
      onSelectNode(nodeId)
    }
  }, [isDrawingMode, drawingSourceNode, onSelectNode])

  // Handle edge creation
  const handleEdgeCreate = useCallback(async (edgeData: { type: string; description?: string }) => {
    if (!pendingEdge) return

    try {
      // Create new edge
      const newEdge: Edge = {
        id: `e${pendingEdge.from}-${pendingEdge.to}`,
        from: pendingEdge.from,
        to: pendingEdge.to,
        type: edgeData.type,
        description: edgeData.description
      }

      // Save to backend
      await FileAPI.createEdge({
        from: newEdge.from,
        to: newEdge.to,
        type: newEdge.type!,
        description: newEdge.description
      })

      // Add to local state
      setEdges(prev => [...prev, newEdge])

      // Show success message
      toast.success("Edge created successfully!")

      // Close modal and reset state
      setShowEdgeModal(false)
      setPendingEdge(null)
    } catch (error) {
      console.error('Failed to create edge:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create edge')
    }
  }, [pendingEdge])

  // Handle edge deletion
  const handleEdgeDelete = useCallback(async (from: string, to: string, type: string) => {
    try {
      await FileAPI.deleteEdge(from, to, type)
      
      // Remove from local state
      setEdges(prev => prev.filter(edge => !(
        edge.from === from && edge.to === to && edge.type === type
      )))
      
      toast.success("Edge deleted successfully!")
      setEdgeToDelete(null)
    } catch (error) {
      console.error('Failed to delete edge:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete edge')
    }
  }, [])

  const handleNodeDragStart = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      setDraggingNode(nodeId)
      setDragOffset({
        x: (e.clientX - rect.left) / zoom - pan.x - node.x,
        y: (e.clientY - rect.top) / zoom - pan.y - node.y,
      })
      onSelectNode(nodeId)
    },
    [nodes, zoom, pan, onSelectNode],
  )

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        e.preventDefault()
        setIsPanning(true)
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      } else if (e.button === 0 && e.target === e.currentTarget) {
        onSelectNode(null)
      }
    },
    [pan, onSelectNode],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggingNode) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return

        const newX = (e.clientX - rect.left) / zoom - pan.x - dragOffset.x
        const newY = (e.clientY - rect.top) / zoom - pan.y - dragOffset.y

        setNodes((prev) =>
          prev.map((node) =>
            node.id === draggingNode ? { ...node, x: Math.max(0, newX), y: Math.max(0, newY) } : node,
          ),
        )
      } else if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        })
      } else if (connectingFrom) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        setTempEdge({
          x: (e.clientX - rect.left) / zoom - pan.x,
          y: (e.clientY - rect.top) / zoom - pan.y,
        })
      }
    },
    [draggingNode, isPanning, connectingFrom, zoom, pan, dragOffset, panStart],
  )

  const handleMouseUp = useCallback(async () => {
    // If we were dragging a node, update its position on the backend
    if (draggingNode) {
      const node = nodes.find((n) => n.id === draggingNode)
      if (node) {
        try {
          await FileAPI.updateFilePosition(node.id, node.x, node.y)
          // Refresh metadata after position update
          const updatedMetadata = await FileAPI.getMetadata()
          setMetadata(updatedMetadata)
        } catch (error) {
          console.error('Failed to update node position:', error)
        }
      }
    }
    
    setDraggingNode(null)
    setIsPanning(false)
    setConnectingFrom(null)
    setTempEdge(null)
  }, [draggingNode, nodes])

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom((prev) => Math.max(0.25, Math.min(2, prev + delta)))
    }
  }, [])

  const handleConnectionStart = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      setConnectingFrom(nodeId)
      onSelectNode(nodeId)
    },
    [onSelectNode],
  )

  const handleConnectionEnd = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (connectingFrom && connectingFrom !== nodeId) {
        const newEdge: Edge = {
          id: `e${connectingFrom}-${nodeId}`,
          from: connectingFrom,
          to: nodeId,
        }
        setEdges((prev) => [...prev, newEdge])
      }
      setConnectingFrom(null)
      setTempEdge(null)
    },
    [connectingFrom],
  )

  const handleNodeDelete = useCallback(
    async (nodeId: string) => {
      try {
        // Delete from backend (which also deletes the actual file)
        await FileAPI.deleteFile(nodeId)
        
        // Remove from local state
        setNodes((prev) => prev.filter((n) => n.id !== nodeId))
        setEdges((prev) => prev.filter((e) => e.from !== nodeId && e.to !== nodeId))
        
        if (selectedNode === nodeId) {
          onSelectNode(null)
        }
        if (expandedNode === nodeId) {
          setExpandedNode(null)
        }
      } catch (error) {
        console.error('Failed to delete file:', error)
        // You could add a toast notification here
      }
    },
    [selectedNode, onSelectNode, expandedNode],
  )

  const handleNodeExpand = useCallback((nodeId: string) => {
    setExpandedNode(expandedNode === nodeId ? null : nodeId)
  }, [expandedNode])

  const handleFileSave = useCallback(async (nodeId: string, content: string) => {
    try {
      await FileAPI.updateFileContent(nodeId, content)
      setNodes((prev) => prev.map((node) => 
        node.id === nodeId 
          ? { ...node, content, isModified: false }
          : node
      ))
    } catch (error) {
      console.error('Failed to save file:', error)
      // Re-throw the error so the CodeEditor can handle it
      throw error
    }
  }, [])

  const handleFileCreate = useCallback(async (fileName: string, fileType: string, description?: string) => {
    const result = await FileAPI.createFile({
      filePath: fileName,
      fileType: fileType,
      content: "",
      description: description
    })
    
    if (!result.success) {
      // Show toast for error
      toast.error('Failed to create file', {
        description: result.error || `File "${fileName}" already exists`,
        duration: 2000,
      })
      return
    }
    
    const newFile = result.data!
    
    // Update the position if we have a pending drop
    if (pendingFileDrop) {
      await FileAPI.updateFilePosition(newFile.id, pendingFileDrop.x, pendingFileDrop.y)
      newFile.x = pendingFileDrop.x
      newFile.y = pendingFileDrop.y
    }
    
    setNodes((prev) => [...prev, newFile as NodeData])
    
    // Refresh metadata after creating file
    const updatedMetadata = await FileAPI.getMetadata()
    setMetadata(updatedMetadata)
    
    setShowFileModal(false)
    setPendingFileDrop(null)
  }, [pendingFileDrop])

  const handleGenerateCode = useCallback(async (nodeId: string) => {
    try {
      setGeneratingNodeId(nodeId)
      const result = await FileAPI.generateFileCode(nodeId)
      if (result.success) {
        toast.success('Code generated successfully', {
          description: `Generated ${result.data?.file_name}`,
          duration: 2000,
        })
        
        // Refresh files and metadata after generation
        const files = await FileAPI.getFiles()
        const metadata = await FileAPI.getMetadata()
        setNodes(files as NodeData[])
        setMetadata(metadata)
      } else {
        toast.error('Failed to generate code', {
          description: result.error || 'Unknown error occurred',
          duration: 3000,
        })
      }
    } catch (error) {
      console.error('Failed to generate code:', error)
      toast.error('Failed to generate code', {
        description: 'Network error occurred',
        duration: 3000,
      })
    } finally {
      setGeneratingNodeId(null)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const nodeData = e.dataTransfer.getData("application/json")
      if (!nodeData) return

      const data = JSON.parse(nodeData)
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = (e.clientX - rect.left) / zoom - pan.x
      const y = (e.clientY - rect.top) / zoom - pan.y

      // Handle file node drops
      if (data.type === "file" && data.isSpecial) {
        setPendingFileDrop({ x: Math.max(0, x - 96), y: Math.max(0, y - 40) })
        setShowFileModal(true)
        return
      }

      // Handle regular node drops
      const newNode: NodeData = {
        id: `node-${Date.now()}`,
        type: data.type,
        label: data.label,
        x: Math.max(0, x - 96), // Center the node
        y: Math.max(0, y - 40),
        status: "idle",
      }

      setNodes((prev) => [...prev, newNode])
    },
    [zoom, pan],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener("wheel", handleWheel, { passive: false })
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
      if (canvas) {
        canvas.removeEventListener("wheel", handleWheel)
      }
    }
  }, [handleMouseMove, handleMouseUp, handleWheel])


  return (
    <div className="h-full w-full relative overflow-hidden neu-inset bg-background">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full neu-raised bg-card mx-auto mb-4 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Loading files...</p>
          </div>
        </div>
      ) : (
        <>
      {/* Canvas controls - top right */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
          className="neu-raised neu-hover neu-active bg-card text-foreground"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setZoom(Math.max(zoom - 0.1, 0.25))}
          className="neu-raised neu-hover neu-active bg-card text-foreground"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setZoom(1)
            setPan({ x: 0, y: 0 })
          }}
          className="neu-raised neu-hover neu-active bg-card text-foreground"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant={isDrawingMode ? "default" : "ghost"}
          onClick={() => {
            if (isDrawingMode) {
              // Exit drawing mode
              setIsDrawingMode(false)
              setDrawingSourceNode(null)
            } else {
              // Enter drawing mode
              setIsDrawingMode(true)
            }
          }}
          className={`neu-raised neu-hover neu-active ${
            isDrawingMode 
              ? "bg-primary text-primary-foreground" 
              : "bg-card text-foreground"
          }`}
        >
          <Link className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            try {
              const folderName = prompt('Enter folder name:', 'New Folder')
              if (!folderName) return
              
              const newFolder = await FileAPI.createFolder(folderName, 150, 150)
              const updatedFolders = await FileAPI.getFolders()
              setFolders(updatedFolders)
              toast.success('Folder created!')
            } catch (error) {
              console.error('Failed to create folder:', error)
              toast.error('Failed to create folder')
            }
          }}
          className="neu-raised neu-hover neu-active bg-card text-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-2">
            <path d="M2 4C2 2.89543 2.89543 2 4 2H6.17157C6.70201 2 7.21071 2.21071 7.58579 2.58579L8.41421 3.41421C8.78929 3.78929 9.29799 4 9.82843 4H12C13.1046 4 14 4.89543 14 6V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Folder
        </Button>
      </div>

      {/* Grid background with pan/zoom */}
      <div
        ref={canvasRef}
        className="w-full h-full relative"
        onMouseDown={handleCanvasMouseDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          cursor: isPanning ? "grabbing" : draggingNode ? "grabbing" : "default",
        }}
      >
        <div
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: "0 0",
            width: "100%",
            height: "100%",
            backgroundImage: `
              linear-gradient(to right, oklch(0.22 0.01 250) 1px, transparent 1px),
              linear-gradient(to bottom, oklch(0.22 0.01 250) 1px, transparent 1px)
            `,
            backgroundSize: "20px 20px",
          }}
        >
          {/* Edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
            <defs>
              {/* Gradient definitions */}
              <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="oklch(0.5 0.15 250)" stopOpacity="0.8" />
                <stop offset="100%" stopColor="oklch(0.6 0.18 260)" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="edgeGradientActive" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="oklch(0.65 0.22 250)" stopOpacity="1" />
                <stop offset="100%" stopColor="oklch(0.7 0.24 260)" stopOpacity="1" />
              </linearGradient>
              {/* Glow filter for hover */}
              <filter id="edgeGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.from)
              const toNode = nodes.find((n) => n.id === edge.to)
              if (!fromNode || !toNode) return null

              const fromX = fromNode.x + 192
              const fromY = fromNode.y + 60
              const toX = toNode.x
              const toY = toNode.y + 60

              const isActive =
                (fromNode.status === "running" || fromNode.status === "success") &&
                toNode.status !== "idle"
              
              const isHovered = hoveredEdge === edge.id
              const centerX = (fromX + toX) / 2
              const centerY = (fromY + toY) / 2

              return (
                <g key={edge.id}>
                  <defs>
                    <marker
                      id={`arrowhead-${edge.id}`}
                      markerWidth="12"
                      markerHeight="12"
                      refX="10"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 3.5, 0 7"
                        fill={isActive ? "url(#edgeGradientActive)" : isHovered ? "oklch(0.6 0.18 250)" : "oklch(0.4 0.05 250)"}
                      />
                    </marker>
                  </defs>
                  
                  {/* Invisible wider path for easier hover */}
                  <path
                    d={`M ${fromX} ${fromY} C ${fromX + 100} ${fromY}, ${toX - 100} ${toY}, ${toX} ${toY}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="20"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredEdge(edge.id)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setEdgeToDelete({ from: edge.from, to: edge.to, type: edge.type || 'depends_on' })
                    }}
                  />
                  
                  {/* Visible edge path */}
                  <path
                    d={`M ${fromX} ${fromY} C ${fromX + 100} ${fromY}, ${toX - 100} ${toY}, ${toX} ${toY}`}
                    fill="none"
                    stroke={isActive ? "url(#edgeGradientActive)" : isHovered ? "oklch(0.6 0.18 250)" : "oklch(0.4 0.05 250)"}
                    strokeWidth={isHovered ? "3" : "2"}
                    markerEnd={`url(#arrowhead-${edge.id})`}
                    className={isActive ? "animate-pulse" : ""}
                    style={{ 
                      pointerEvents: 'none',
                      filter: isHovered ? 'url(#edgeGlow)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  />
                  
                  {/* Edge type label with improved styling */}
                  {edge.type && (
                    <g style={{ pointerEvents: 'none' }}>
                      {(() => {
                        const displayText = edgeTypeDisplay[edge.type] || edge.type.replace('_', ' ')
                        const textWidth = displayText.length * 7 + 16
                        const textHeight = 20
                        
                        return (
                          <>
                            {/* Shadow for depth */}
                            <rect
                              x={centerX - textWidth / 2 + 1}
                              y={centerY - textHeight / 2 + 1}
                              width={textWidth}
                              height={textHeight}
                              rx="10"
                              fill="oklch(0 0 0 / 0.3)"
                            />
                            {/* Background with gradient */}
                            <rect
                              x={centerX - textWidth / 2}
                              y={centerY - textHeight / 2}
                              width={textWidth}
                              height={textHeight}
                              rx="10"
                              fill={isHovered ? "oklch(0.25 0.05 250)" : "oklch(0.18 0.02 250)"}
                              stroke={isHovered ? "oklch(0.5 0.15 250)" : "oklch(0.35 0.05 250)"}
                              strokeWidth="1.5"
                              style={{ transition: 'all 0.2s ease' }}
                            />
                            {/* Edge type text */}
                            <text
                              x={centerX}
                              y={centerY + 4}
                              textAnchor="middle"
                              fontSize="11"
                              fill={isHovered ? "oklch(0.85 0.1 250)" : "oklch(0.75 0.05 250)"}
                              fontFamily="system-ui, -apple-system, sans-serif"
                              fontWeight="600"
                              style={{ transition: 'all 0.2s ease' }}
                            >
                              {displayText}
                            </text>
                          </>
                        )
                      })()}
                    </g>
                  )}
                  
                  {/* Delete button on hover */}
                  {isHovered && (
                    <g
                      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEdgeToDelete({ from: edge.from, to: edge.to, type: edge.type || 'depends_on' })
                      }}
                    >
                      {/* Delete button background */}
                      <circle
                        cx={centerX + 60}
                        cy={centerY}
                        r="12"
                        fill="oklch(0.25 0.05 250)"
                        stroke="oklch(0.5 0.15 250)"
                        strokeWidth="2"
                        style={{ transition: 'all 0.2s ease' }}
                      />
                      <circle
                        cx={centerX + 60}
                        cy={centerY}
                        r="12"
                        fill="oklch(0.4 0.2 10 / 0.1)"
                      />
                      {/* X icon */}
                      <path
                        d={`M ${centerX + 55} ${centerY - 5} L ${centerX + 65} ${centerY + 5} M ${centerX + 65} ${centerY - 5} L ${centerX + 55} ${centerY + 5}`}
                        stroke="oklch(0.7 0.15 10)"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </g>
                  )}
                  
                  {/* Animated dot for active edges */}
                  {isActive && (
                    <circle r="4" fill="oklch(0.7 0.24 260)">
                      <animateMotion
                        dur="2s"
                        repeatCount="indefinite"
                        path={`M ${fromX} ${fromY} C ${fromX + 100} ${fromY}, ${toX - 100} ${toY}, ${toX} ${toY}`}
                      />
                    </circle>
                  )}
                </g>
              )
            })}

            {/* Temporary edge while connecting */}
            {connectingFrom &&
              tempEdge &&
              (() => {
                const fromNode = nodes.find((n) => n.id === connectingFrom)
                if (!fromNode) return null

                const fromX = fromNode.x + 192
                const fromY = fromNode.y + 60

                return (
                  <path
                    d={`M ${fromX} ${fromY} C ${fromX + 100} ${fromY}, ${tempEdge.x - 100} ${tempEdge.y}, ${tempEdge.x} ${tempEdge.y}`}
                    fill="none"
                    stroke="oklch(0.5 0.15 250)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.6"
                  />
                )
              })()}
          </svg>

          {/* Folders */}
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="absolute"
              style={{
                left: folder.x,
                top: folder.y,
                width: folder.width,
                height: folder.height,
                pointerEvents: 'auto'
              }}
            >
              {/* Folder Container */}
              <div className="relative w-full h-full rounded-2xl border-2 border-primary/30 bg-card/40 backdrop-blur-sm shadow-lg">
                {/* Folder Header */}
                <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-r from-primary/20 to-primary/10 rounded-t-2xl border-b border-primary/30 flex items-center px-4 gap-3">
                  <button
                    onClick={async () => {
                      try {
                        await FileAPI.updateFolder(folder.id, { isExpanded: !folder.isExpanded })
                        const updatedFolders = await FileAPI.getFolders()
                        setFolders(updatedFolders)
                      } catch (error) {
                        console.error('Failed to toggle folder:', error)
                      }
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-primary/20 transition-colors"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className={`transition-transform ${folder.isExpanded ? 'rotate-90' : ''}`}
                    >
                      <path
                        d="M6 4L10 8L6 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <span className="text-sm font-semibold text-foreground">{folder.name}</span>
                  <span className="text-xs text-muted-foreground">({folder.containedFiles.length} files)</span>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete folder "${folder.name}"?`)) {
                        try {
                          await FileAPI.deleteFolder(folder.id)
                          const updatedFolders = await FileAPI.getFolders()
                          setFolders(updatedFolders)
                          toast.success('Folder deleted')
                        } catch (error) {
                          console.error('Failed to delete folder:', error)
                          toast.error('Failed to delete folder')
                        }
                      }
                    }}
                    className="ml-auto w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/20 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                
                {/* Folder Content Area */}
                {folder.isExpanded && (
                  <div className="absolute top-12 left-0 right-0 bottom-0 p-4 overflow-hidden">
                    <div className="text-xs text-muted-foreground text-center mt-8">
                      Drag files here to organize
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Nodes */}
          {nodes.map((node) => (
            <Node
              key={node.id}
              id={node.id}
              type={node.type}
              label={node.label}
              x={node.x}
              y={node.y}
              status={node.status}
              isSelected={selectedNode === node.id}
              onSelect={() => handleNodeSelect(node.id)}
              onDragStart={handleNodeDragStart}
              onDelete={handleNodeDelete}
              onConnectionStart={handleConnectionStart}
              onConnectionEnd={handleConnectionEnd}
              filePath={node.filePath}
              fileType={node.fileType}
              content={node.content}
              isExpanded={expandedNode === node.id}
              isModified={node.isModified}
              onExpand={handleNodeExpand}
              onGenerateCode={handleGenerateCode}
              isGenerating={generatingNodeId === node.id}
              isDrawingMode={isDrawingMode}
              isDrawingSource={drawingSourceNode === node.id}
              isDrawingTarget={isDrawingMode && !!drawingSourceNode && drawingSourceNode !== node.id}
            />
          ))}
        </div>
      </div>

      {/* Metadata Debug Panel */}
      <div className="absolute bottom-4 left-4 neu-raised bg-card rounded-lg p-3 max-w-sm">
        <h3 className="text-sm font-semibold text-foreground mb-2">Metadata ({Object.keys(metadata).length} nodes)</h3>
        <div className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
          {Object.values(metadata).map((nodeMeta) => (
            <div key={nodeMeta.id} className="flex justify-between">
              <span className="font-mono">{nodeMeta.id}</span>
              <span className="text-blue-400">{nodeMeta.type}</span>
              <span className="text-green-400">({nodeMeta.x}, {nodeMeta.y})</span>
            </div>
          ))}
          {Object.keys(metadata).length === 0 && (
            <div className="text-muted-foreground italic">No metadata yet</div>
          )}
        </div>
      </div>

      {/* File Naming Modal */}
      <FileNamingModal
        isOpen={showFileModal}
        onClose={() => {
          setShowFileModal(false)
          setPendingFileDrop(null)
        }}
        onCreateFile={handleFileCreate}
      />

      {/* Edge Creation Modal */}
      <EdgeCreationModal
        isOpen={showEdgeModal && !!pendingEdge}
        onClose={() => {
          setShowEdgeModal(false)
          setPendingEdge(null)
        }}
        onCreateEdge={handleEdgeCreate}
        fromNodeId={pendingEdge?.from || ""}
        toNodeId={pendingEdge?.to || ""}
      />

      {/* Edge Deletion Confirmation Modal */}
      {edgeToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 w-96 max-w-[90vw] border border-border/20">
            <h3 className="text-lg font-semibold mb-4">Delete Edge</h3>
            
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete the edge from <span className="font-medium text-foreground">{edgeToDelete.from}</span> to <span className="font-medium text-foreground">{edgeToDelete.to}</span>?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Type: {edgeTypeDisplay[edgeToDelete.type] || edgeToDelete.type}
              </p>
            </div>
            
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setEdgeToDelete(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleEdgeDelete(edgeToDelete.from, edgeToDelete.to, edgeToDelete.type)}
                className="flex-1"
              >
                Delete Edge
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Code Editor Modal */}
      {expandedNode && (() => {
        const node = nodes.find(n => n.id === expandedNode)
        if (!node || node.type !== 'file') return null
        
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

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 neu-raised bg-card px-3 py-1.5 rounded-lg">
        <span className="text-xs font-mono text-muted-foreground">{Math.round(zoom * 100)}%</span>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 neu-raised bg-card px-3 py-2 rounded-lg max-w-xs">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">Drag</span> nodes to move • <span className="font-semibold">Shift+Drag</span>{" "}
          to pan • <span className="font-semibold">Ctrl+Wheel</span> to zoom
        </p>
      </div>
        </>
      )}
    </div>
  )
}
