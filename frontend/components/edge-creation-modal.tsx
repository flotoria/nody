"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface EdgeCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateEdge: (edgeData: { type: string; description?: string }) => void
  fromNodeId: string
  toNodeId: string
}

export function EdgeCreationModal({ 
  isOpen, 
  onClose, 
  onCreateEdge, 
  fromNodeId, 
  toNodeId 
}: EdgeCreationModalProps) {
  const [edgeType, setEdgeType] = useState("depends_on")
  const [description, setDescription] = useState("")

  const handleSubmit = () => {
    onCreateEdge({
      type: edgeType,
      description: description.trim() || undefined
    })
    setEdgeType("depends_on")
    setDescription("")
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 w-96 max-w-[90vw] border border-border/20">
        <h3 className="text-lg font-semibold mb-4">Create Edge</h3>
        
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Creating edge from <span className="font-medium text-foreground">{fromNodeId}</span> to <span className="font-medium text-foreground">{toNodeId}</span>
          </p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Relationship Type *
            </label>
            <select 
              className="w-full p-2 rounded-lg border border-border/20 bg-background text-foreground"
              value={edgeType}
              onChange={(e) => setEdgeType(e.target.value)}
            >
              <option value="depends_on">depends on</option>
              <option value="uses">uses</option>
              <option value="imports">imports</option>
              <option value="calls">calls</option>
              <option value="extends">extends</option>
              <option value="implements">implements</option>
              <option value="references">references</option>
              <option value="contains">contains</option>
              <option value="belongs_to">belongs to</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Description (optional)
            </label>
            <textarea 
              className="w-full p-2 rounded-lg border border-border/20 bg-background text-foreground h-20 resize-none"
              placeholder="Describe the relationship..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1"
          >
            Create Edge
          </Button>
        </div>
      </div>
    </div>
  )
}
