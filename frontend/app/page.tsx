"use client"

import { useState, useEffect } from "react"
import { LeftSidebar } from "@/components/left-sidebar"
import { Canvas } from "@/components/canvas"
import { RightSidebar } from "@/components/right-sidebar"
import { BottomDock } from "@/components/bottom-dock"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Home } from "lucide-react"
import type { FileNode, NodeMetadata } from "@/lib/api"
import { FileAPI } from "@/lib/api"

interface ConsoleMessage {
  timestamp: string
  level: 'INFO' | 'SUCCESS' | 'ERROR' | 'DEBUG'
  message: string
}

export default function NodeFlowPage() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [nodes, setNodes] = useState<FileNode[]>([])
  const [metadata, setMetadata] = useState<Record<string, NodeMetadata>>({})
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([])

  // Poll for real-time output messages
  useEffect(() => {
    const pollOutput = async () => {
      try {
        const output = await FileAPI.getOutput()
        if (output.messages && output.messages.length > 0) {
          const formattedMessages = output.messages.map(msg => ({
            timestamp: msg.timestamp,
            level: msg.level as 'INFO' | 'SUCCESS' | 'ERROR' | 'DEBUG',
            message: msg.message
          }))
          setConsoleMessages(formattedMessages)
        }
      } catch (error) {
        console.error('Failed to fetch output:', error)
      }
    }

    // Poll every 2 seconds for output updates
    const interval = setInterval(pollOutput, 2000)

    // Initial poll
    pollOutput()

    return () => clearInterval(interval)
  }, [])

  const handleDataChange = (updatedNodes: FileNode[], updatedMetadata: Record<string, NodeMetadata>) => {
    setNodes(updatedNodes)
    setMetadata(updatedMetadata)
  }

  const handleUpdateDescription = async (nodeId: string, description: string) => {
    console.log('Main page: handleUpdateDescription called', { nodeId, description })
    try {
      console.log('Main page: calling FileAPI.updateFileDescription')
      await FileAPI.updateFileDescription(nodeId, description)
      console.log('Main page: API call successful, refreshing metadata')
      // Refresh metadata after updating description
      const updatedMetadata = await FileAPI.getMetadata()
      console.log('Main page: got updated metadata:', updatedMetadata)
      setMetadata(updatedMetadata)
    } catch (error) {
      console.error('Main page: Failed to update description:', error)
    }
  }


  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <LeftSidebar selectedNode={selectedNode} nodes={nodes} metadata={metadata} onUpdateDescription={handleUpdateDescription} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 shrink-0 neu-inset-sm bg-background px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-foreground text-soft-shadow">NodeFlow Project</h1>
            <span className="text-sm text-muted-foreground">Visual Development Environment</span>
          </div>
          <Button asChild variant="ghost" size="sm" className="neu-raised-sm neu-hover neu-active">
            <Link href="/onboarding">
              <Home className="w-4 h-4 mr-2" />
              Home
            </Link>
          </Button>
        </header>

        <Canvas
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
          onDataChange={handleDataChange}
        />


        <BottomDock consoleMessages={consoleMessages} />
      </div>

      <RightSidebar />
    </div>
  )
}
