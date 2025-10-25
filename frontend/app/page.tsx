"use client"

import { useState } from "react"
import { LeftSidebar } from "@/components/left-sidebar"
import { Canvas } from "@/components/canvas"
import { RightSidebar } from "@/components/right-sidebar"
import { BottomDock } from "@/components/bottom-dock"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"
import type { FileNode, NodeMetadata } from "@/lib/api"

export default function NodeFlowPage() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [nodes, setNodes] = useState<FileNode[]>([])
  const [metadata, setMetadata] = useState<Record<string, NodeMetadata>>({})

  const handleDataChange = (updatedNodes: FileNode[], updatedMetadata: Record<string, NodeMetadata>) => {
    setNodes(updatedNodes)
    setMetadata(updatedMetadata)
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <LeftSidebar selectedNode={selectedNode} nodes={nodes} metadata={metadata} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 shrink-0 neu-inset-sm bg-background px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-foreground text-soft-shadow">NodeFlow Project</h1>
            <span className="text-sm text-muted-foreground">Visual Development Environment</span>
          </div>
          <Button variant="ghost" size="sm" className="neu-raised-sm neu-hover neu-active">
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
        </header>

        <Canvas
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
          isRunning={isRunning}
          onToggleRun={() => setIsRunning(!isRunning)}
          onDataChange={handleDataChange}
        />

        <BottomDock />
      </div>

      <RightSidebar />
    </div>
  )
}
