"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { ZoomIn, ZoomOut, Maximize2, Play, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Node } from "@/components/node"
import { CodeEditor } from "@/components/code-editor"
import { FileNamingModal } from "@/components/file-naming-modal"
import { FileAPI, FileNode, NodeMetadata } from "@/lib/api"
import { toast } from "sonner"

interface CanvasProps {
  selectedNode: string | null
  onSelectNode: (id: string | null) => void
  isRunning: boolean
  onToggleRun: () => void
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
}

const initialNodes: NodeData[] = [
  { id: "1", type: "file", label: "main.py", x: 100, y: 100, status: "idle", filePath: "main.py", fileType: "python", content: "# FastAPI main file\nfrom fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get(\"/\")\ndef read_root():\n    return {\"Hello\": \"World\"}", isExpanded: false, isModified: false },
  { id: "2", type: "file", label: "models.py", x: 350, y: 100, status: "idle", filePath: "models.py", fileType: "python", content: "# Data models\nfrom pydantic import BaseModel\n\nclass User(BaseModel):\n    id: int\n    name: str\n    email: str", isExpanded: false, isModified: false },
  { id: "3", type: "file", label: "config.py", x: 600, y: 100, status: "idle", filePath: "config.py", fileType: "python", content: "# Configuration\nimport os\n\nDATABASE_URL = os.getenv(\"DATABASE_URL\", \"sqlite:///./app.db\")\nDEBUG = os.getenv(\"DEBUG\", \"False\").lower() == \"true\"", isExpanded: false, isModified: false },
]

const initialEdges: Edge[] = [
  { id: "e1-2", from: "1", to: "2" },
  { id: "e2-3", from: "2", to: "3" },
]

export function Canvas({ selectedNode, onSelectNode, isRunning, onToggleRun, onDataChange }: CanvasProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [nodes, setNodes] = useState<NodeData[]>([])
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

  const canvasRef = useRef<HTMLDivElement>(null)

  // Load files and metadata from API on component mount
  useEffect(() => {
    const loadData = async () => {
      console.log('Canvas: Starting to load data from API')
      try {
        console.log('Canvas: Calling FileAPI.getFiles() and FileAPI.getMetadata()')
        const [files, metadataData] = await Promise.all([
          FileAPI.getFiles(),
          FileAPI.getMetadata()
        ])
        console.log('Canvas: Got files:', files)
        console.log('Canvas: Got metadata:', metadataData)
        setNodes(files as NodeData[])
        setMetadata(metadataData)
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
      // You could add a toast notification here
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

  useEffect(() => {
    if (isRunning) {
      const timer1 = setTimeout(() => {
        setNodes((prev) => prev.map((n) => (n.id === "1" ? { ...n, status: "running" } : n)))
      }, 500)
      const timer2 = setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === "1" ? { ...n, status: "success" } : n.id === "2" ? { ...n, status: "running" } : n,
          ),
        )
      }, 1500)
      const timer3 = setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === "2" ? { ...n, status: "success" } : n.id === "3" ? { ...n, status: "running" } : n,
          ),
        )
      }, 3000)
      const timer4 = setTimeout(() => {
        setNodes((prev) => prev.map((n) => (n.id === "3" ? { ...n, status: "success" } : n)))
      }, 4000)

      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
        clearTimeout(timer4)
      }
    } else {
      setNodes((prev) => prev.map((n) => ({ ...n, status: "idle" })))
    }
  }, [isRunning])

  return (
    <div className="flex-1 relative overflow-hidden neu-inset bg-background">
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
          onClick={onToggleRun}
          size="sm"
          variant="ghost"
          className={`neu-raised neu-hover neu-active ${
            isRunning ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"
          }`}
        >
          {isRunning ? (
            <>
              <Square className="w-4 h-4 mr-2" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run
            </>
          )}
        </Button>

        <div className="w-px h-8 bg-border" />

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
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.from)
              const toNode = nodes.find((n) => n.id === edge.to)
              if (!fromNode || !toNode) return null

              const fromX = fromNode.x + 192
              const fromY = fromNode.y + 60
              const toX = toNode.x
              const toY = toNode.y + 60

              const isActive =
                isRunning &&
                (fromNode.status === "running" || fromNode.status === "success") &&
                toNode.status !== "idle"

              return (
                <g key={edge.id}>
                  <defs>
                    <marker
                      id={`arrowhead-${edge.id}`}
                      markerWidth="10"
                      markerHeight="10"
                      refX="9"
                      refY="3"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 3, 0 6"
                        fill={isActive ? "oklch(0.6 0.18 250)" : "oklch(0.35 0.02 250)"}
                      />
                    </marker>
                  </defs>
                  <path
                    d={`M ${fromX} ${fromY} C ${fromX + 100} ${fromY}, ${toX - 100} ${toY}, ${toX} ${toY}`}
                    fill="none"
                    stroke={isActive ? "oklch(0.6 0.18 250)" : "oklch(0.35 0.02 250)"}
                    strokeWidth="2"
                    markerEnd={`url(#arrowhead-${edge.id})`}
                    className={isActive ? "animate-pulse" : ""}
                  />
                  {isActive && (
                    <circle r="4" fill="oklch(0.6 0.18 250)">
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
              onSelect={() => onSelectNode(node.id)}
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

      {/* Code Editor Overlay */}
      {expandedNode && (() => {
        const node = nodes.find(n => n.id === expandedNode)
        if (!node || node.type !== 'file') return null
        
        return (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <CodeEditor
              content={node.content || ''}
              fileType={node.fileType || 'text'}
              onSave={(content) => handleFileSave(node.id, content)}
              onClose={() => setExpandedNode(null)}
              isModified={node.isModified}
            />
          </div>
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
