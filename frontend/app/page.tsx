"use client"

import { useState, useEffect } from "react"
import { LeftSidebar } from "@/components/left-sidebar"
import { Canvas } from "@/components/canvas"
import { RightSidebar } from "@/components/right-sidebar"
import { BottomDock } from "@/components/bottom-dock"
import { EndpointGenerationModal } from "@/components/endpoint-generation-modal"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Home, Sparkles, Play } from "lucide-react"
import type { FileNode, NodeMetadata } from "@/lib/api"
import { FileAPI } from "@/lib/api"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"

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
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLaunchingApp, setIsLaunchingApp] = useState(false)
  const [showEndpointModal, setShowEndpointModal] = useState(false)
  const [endpointMethod, setEndpointMethod] = useState<"GET" | "POST">("GET")

  // Poll for real-time output messages and metadata updates
  useEffect(() => {
    const pollUpdates = async () => {
      try {
        // Poll output messages
        const output = await FileAPI.getOutput()
        if (output.messages && output.messages.length > 0) {
          const formattedMessages = output.messages.map(msg => ({
            timestamp: msg.timestamp,
            level: msg.level as 'INFO' | 'SUCCESS' | 'ERROR' | 'DEBUG',
            message: msg.message
          }))
          // Only update if messages have actually changed
          setConsoleMessages(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(formattedMessages)) {
              return formattedMessages
            }
            return prev
          })
        }
        
        // Poll raw metadata.json directly
        const metadataResponse = await FileAPI.getMetadataRaw()
        const rawMetadata = JSON.parse(metadataResponse.content)
        const updatedFiles = await FileAPI.getFiles()
        
        // Always update metadata when polling - let React handle re-renders
        setMetadata(rawMetadata)
        
        // Always update files when polling - let React handle re-renders
        setNodes(updatedFiles)
      } catch (error) {
        console.error('Failed to fetch updates:', error)
      }
    }

    // Poll every 1 second for faster updates
    const interval = setInterval(pollUpdates, 1000)

    // Initial poll
    pollUpdates()

    return () => clearInterval(interval)
  }, [])


  const handleUpdateDescription = async (nodeId: string, description: string) => {
    try {
      await FileAPI.updateFileDescription(nodeId, description)
      // Refresh metadata after updating description
      const updatedMetadata = await FileAPI.getMetadata()
      setMetadata(updatedMetadata)
    } catch (error) {
      console.error('Failed to update description:', error)
    }
  }

  const handleToggleRun = async () => {
    if (isGenerating) return
    
    setIsGenerating(true)
    try {
      console.log('Generating files...')
      await FileAPI.runProject()
      console.log('Generation completed')
    } catch (error) {
      console.error('Failed to generate files:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleStartApp = async () => {
    if (isLaunchingApp) return

    setIsLaunchingApp(true)
    try {
      const result = await FileAPI.startApplication()
      console.log('Application launch triggered:', result)
      window.alert(result.message || 'Application launch script started.')
    } catch (error) {
      console.error('Failed to start application:', error)
      window.alert('Failed to start the application. Check the output panel for details.')
    } finally {
      setIsLaunchingApp(false)
    }
  }

  const handleMetadataUpdate = async () => {
    try {
      const updatedMetadata = await FileAPI.getMetadata()
      setMetadata(updatedMetadata)
      const updatedFiles = await FileAPI.getFiles()
      setNodes(updatedFiles)
    } catch (error) {
      console.error('Failed to update metadata:', error)
    }
  }

  const handleGenerateEndpoint = (method: "GET" | "POST") => {
    setEndpointMethod(method)
    setShowEndpointModal(true)
  }


  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left Sidebar */}
        <Panel defaultSize={20} minSize={15} maxSize={35} className="min-w-0">
          <LeftSidebar 
            selectedNode={selectedNode} 
            nodes={nodes} 
            metadata={metadata} 
            onUpdateDescription={handleUpdateDescription}
            onGenerateEndpoint={handleGenerateEndpoint}
          />
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />

        {/* Main Content Area */}
        <Panel defaultSize={60} minSize={30} className="min-w-0">
          <PanelGroup direction="vertical" className="h-full">
            {/* Header */}
            <Panel defaultSize={8} minSize={6} maxSize={12} className="min-h-0">
              <header className="h-full neu-inset-sm bg-background px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="font-semibold text-foreground text-soft-shadow">NodeFlow Project</h1>
                  <span className="text-sm text-muted-foreground">Visual Development Environment</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleToggleRun}
                    disabled={isGenerating}
                    className="bg-purple-600 hover:bg-purple-700 text-white neu-raised-sm neu-hover neu-active disabled:opacity-50 disabled:cursor-not-allowed"
                    size="sm"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate All
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleStartApp}
                    disabled={isLaunchingApp}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white neu-raised-sm neu-hover neu-active disabled:opacity-50 disabled:cursor-not-allowed"
                    size="sm"
                  >
                    {isLaunchingApp ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Run App
                      </>
                    )}
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="neu-raised-sm neu-hover neu-active">
                    <Link href="/onboarding">
                      <Home className="w-4 h-4 mr-2" />
                      Home
                    </Link>
                  </Button>
                </div>
              </header>
            </Panel>

            <PanelResizeHandle className="h-1 bg-border hover:bg-primary/50 transition-colors cursor-row-resize" />

            {/* Canvas */}
            <Panel defaultSize={70} minSize={40} className="min-h-0">
              <Canvas
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
                onMetadataUpdate={setMetadata}
              />
            </Panel>

            <PanelResizeHandle className="h-1 bg-border hover:bg-primary/50 transition-colors cursor-row-resize" />

            {/* Bottom Dock */}
            <Panel defaultSize={22} minSize={15} maxSize={40} className="min-h-0">
              <BottomDock consoleMessages={consoleMessages} />
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />

        {/* Right Sidebar */}
        <Panel defaultSize={20} minSize={15} maxSize={35} className="min-w-0">
          <RightSidebar onMetadataUpdate={handleMetadataUpdate} />
        </Panel>
      </PanelGroup>
      
      <EndpointGenerationModal 
        isOpen={showEndpointModal} 
        onClose={() => setShowEndpointModal(false)} 
        method={endpointMethod}
      />
    </div>
  )
}

