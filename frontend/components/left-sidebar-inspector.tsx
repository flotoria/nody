"use client"

import { Settings, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FileNode, NodeMetadata } from "@/lib/api"
import { useState, useEffect } from "react"

interface InspectorProps {
  selectedNode: string | null
  nodes: FileNode[]
  metadata: Record<string, NodeMetadata>
  onUpdateDescription?: (nodeId: string, description: string) => void
}

export function Inspector({ selectedNode, nodes, metadata, onUpdateDescription }: InspectorProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editingDescription, setEditingDescription] = useState("")

  // Sync editingDescription with metadata when it changes (but not when editing)
  useEffect(() => {
    if (selectedNode && metadata[selectedNode] && !isEditingDescription) {
      const newDescription = metadata[selectedNode].description || ''
      // Only update if the description has actually changed
      if (newDescription !== editingDescription) {
        setEditingDescription(newDescription)
      }
    }
  }, [selectedNode, metadata, isEditingDescription, editingDescription])

  const handleStartEdit = () => {
    const nodeMeta = metadata[selectedNode!]
    if (nodeMeta) {
      setEditingDescription(nodeMeta.description || '')
      setIsEditingDescription(true)
    }
  }

  const handleSaveDescription = () => {
    console.log('Inspector: handleSaveDescription called', { selectedNode, editingDescription, onUpdateDescription: !!onUpdateDescription })
    if (onUpdateDescription && selectedNode) {
      console.log('Inspector: calling onUpdateDescription with:', selectedNode, editingDescription)
      onUpdateDescription(selectedNode, editingDescription)
      setIsEditingDescription(false)
    } else {
      console.log('Inspector: onUpdateDescription or selectedNode missing')
    }
  }

  const handleCancelEdit = () => {
    setIsEditingDescription(false)
    setEditingDescription("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveDescription()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }
  if (!selectedNode) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full neu-raised bg-card mx-auto mb-4 flex items-center justify-center">
            <Settings className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Select a node to view details</p>
        </div>
      </div>
    )
  }

  const node = nodes.find((n) => n.id === selectedNode)
  const nodeMeta = metadata[selectedNode]

  // Debug logging

  if (!node && !nodeMeta) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No data found for selected node
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="neu-raised bg-card rounded-xl p-4">
        <h3 className="font-semibold text-foreground mb-3 text-embossed">Node Details</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Node ID</label>
            <div className="neu-inset bg-background rounded px-3 py-2 mt-1">
              <span className="text-sm font-mono text-foreground">{selectedNode}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <div className="neu-inset bg-background rounded px-3 py-2 mt-1">
              <span className="text-sm text-foreground capitalize">
                {node?.type || nodeMeta?.type || "Unknown"}
              </span>
            </div>
          </div>
          {node?.fileType && (
            <div>
              <label className="text-xs text-muted-foreground">File Type</label>
              <div className="neu-inset bg-background rounded px-3 py-2 mt-1">
                <span className="text-sm text-foreground">{node.fileType}</span>
              </div>
            </div>
          )}
          {node?.filePath && (
            <div>
              <label className="text-xs text-muted-foreground">File Path</label>
              <div className="neu-inset bg-background rounded px-3 py-2 mt-1">
                <span className="text-sm font-mono text-foreground">{node.filePath}</span>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <div className="neu-inset bg-background rounded px-3 py-2 mt-1 flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${node?.status === "running"
                    ? "bg-blue-500"
                    : node?.status === "success"
                      ? "bg-green-500"
                      : node?.status === "failed"
                        ? "bg-red-500"
                        : "bg-gray-500"
                  }`}
              />
              <span className="text-sm text-foreground capitalize">{node?.status || "idle"}</span>
            </div>
          </div>

          {/* Description Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Description</label>
              {!isEditingDescription && onUpdateDescription && nodeMeta && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleStartEdit}
                  className="h-6 w-6 p-0 neu-raised-sm neu-hover"
                >
                  <Settings className="w-3 h-3" />
                </Button>
              )}
            </div>

            {isEditingDescription ? (
              <div className="space-y-2">
                <Input
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="text-xs neu-inset bg-background"
                  placeholder="Enter description..."
                  autoFocus
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    onClick={handleSaveDescription}
                    className="h-6 px-2 neu-primary text-primary-foreground neu-hover"
                  >
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    className="h-6 px-2 neu-raised-sm neu-hover"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="neu-inset bg-background rounded px-3 py-2">
                <span className="text-sm text-foreground wrap-break-word">
                  {(nodeMeta?.description ?? editingDescription) || "No description available"}
                </span>
              </div>
            )}

          </div>

          {/* Position Fields */}
          {nodeMeta && (
            <>
              <div>
                <label className="text-xs text-muted-foreground">Position X</label>
                <div className="neu-inset bg-background rounded px-3 py-2 mt-1">
                  <span className="text-sm font-mono text-foreground">{nodeMeta.x?.toFixed(2) ?? '0.00'}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Position Y</label>
                <div className="neu-inset bg-background rounded px-3 py-2 mt-1">
                  <span className="text-sm font-mono text-foreground">{nodeMeta.y?.toFixed(2) ?? '0.00'}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Coordinates</label>
                <div className="neu-inset bg-background rounded px-3 py-2 mt-1">
                  <span className="text-sm font-mono text-foreground">
                    ({nodeMeta.x?.toFixed(0) ?? '0'}, {nodeMeta.y?.toFixed(0) ?? '0'})
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}


