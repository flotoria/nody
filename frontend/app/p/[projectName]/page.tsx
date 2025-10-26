"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { LeftSidebar } from "@/components/left-sidebar"
import { Canvas } from "@/components/canvas"
import { RightSidebar } from "@/components/right-sidebar"
import { BottomDock } from "@/components/bottom-dock"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Home, Sparkles, ArrowLeft } from "lucide-react"
import type { FileNode, NodeMetadata } from "@/lib/api"
import { FileAPI } from "@/lib/api"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"

interface ConsoleMessage {
    timestamp: string
    level: 'INFO' | 'SUCCESS' | 'ERROR' | 'DEBUG'
    message: string
}

export default function ProjectPage() {
    const params = useParams()
    const router = useRouter()
    const projectName = params.projectName as string

    console.log('ProjectPage: params:', params)
    console.log('ProjectPage: params.projectName:', params.projectName)

    console.log('ProjectPage: Loading project:', projectName)
    console.log('ProjectPage: projectName type:', typeof projectName)
    console.log('ProjectPage: projectName is undefined:', projectName === undefined)

    const [selectedNode, setSelectedNode] = useState<string | null>(null)
    const [nodes, setNodes] = useState<FileNode[]>([])
    const [metadata, setMetadata] = useState<Record<string, NodeMetadata>>({})
    const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([])
    const [isGenerating, setIsGenerating] = useState(false)

    // Poll for real-time output messages and metadata updates
    useEffect(() => {
        const pollUpdates = async () => {
            try {
                // Poll output messages
                const output = await FileAPI.getOutput(projectName)
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
                console.log('ProjectPage: Fetching metadata for project:', projectName)
                const metadataResponse = await FileAPI.getMetadataRaw(projectName)
                console.log('ProjectPage: Metadata response:', metadataResponse)
                const rawMetadata = JSON.parse(metadataResponse.content)
                console.log('ProjectPage: Parsed metadata:', rawMetadata)

                console.log('ProjectPage: Fetching files for project:', projectName)
                const updatedFiles = await FileAPI.getFiles(projectName)
                console.log('ProjectPage: Files response:', updatedFiles)

                // Improved metadata change detection
                setMetadata(prev => {
                    const prevKeys = Object.keys(prev)
                    const newKeys = Object.keys(rawMetadata)
                    const prevKeysSet = new Set(prevKeys)
                    const newKeysSet = new Set(newKeys)

                    // Check if keys have changed
                    const keysChanged = prevKeys.length !== newKeys.length ||
                        ![...prevKeysSet].every(key => newKeysSet.has(key)) ||
                        ![...newKeysSet].every(key => prevKeysSet.has(key))

                    // Check if content has changed (more robust comparison)
                    const contentChanged = keysChanged ||
                        Object.keys(rawMetadata).some(key => {
                            const prevValue = prev[key]
                            const newValue = rawMetadata[key]
                            return JSON.stringify(prevValue) !== JSON.stringify(newValue)
                        })

                    if (prevKeys.length === 0 || contentChanged) {
                        console.log('Project page: Metadata updated from polling:', {
                            prevKeys: prevKeys.length,
                            newKeys: newKeys.length,
                            keysChanged,
                            contentChanged,
                            rawMetadata
                        })
                        return rawMetadata
                    }
                    return prev
                })

                setNodes(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(updatedFiles)) {
                        console.log('Project page: Files updated from polling:', updatedFiles)
                        return updatedFiles
                    }
                    return prev
                })
            } catch (error) {
                console.error('Failed to fetch updates:', error)
                // If project doesn't exist (404), stop polling and redirect to onboarding
                if (error instanceof Error && (error.message.includes('404') || error.message.includes('Failed to fetch project'))) {
                    console.log('Project not found, redirecting to onboarding')
                    router.replace('/onboarding')
                    return
                }
            }
        }

        // Poll every 1 second for faster updates
        const interval = setInterval(pollUpdates, 1000)

        // Initial poll
        pollUpdates()

        return () => clearInterval(interval)
    }, [projectName])


    const handleUpdateDescription = async (nodeId: string, description: string) => {
        try {
            await FileAPI.updateFileDescription(nodeId, description, projectName)
            // Refresh metadata after updating description
            const updatedMetadata = await FileAPI.getMetadata(projectName)
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
            await FileAPI.runProject(projectName)
            console.log('Generation completed')
        } catch (error) {
            console.error('Failed to generate files:', error)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleMetadataUpdate = async () => {
        try {
            const updatedMetadata = await FileAPI.getMetadata(projectName)
            setMetadata(updatedMetadata)
            const updatedFiles = await FileAPI.getFiles(projectName)
            setNodes(updatedFiles)
        } catch (error) {
            console.error('Failed to update metadata:', error)
        }
    }


    return (
        <div className="h-screen flex overflow-hidden bg-background">
            <PanelGroup direction="horizontal" className="flex-1">
                {/* Left Sidebar */}
                <Panel defaultSize={20} minSize={15} maxSize={35} className="min-w-0">
                    <LeftSidebar selectedNode={selectedNode} nodes={nodes} metadata={metadata} onUpdateDescription={handleUpdateDescription} />
                </Panel>

                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />

                {/* Main Content Area */}
                <Panel defaultSize={60} minSize={30} className="min-w-0">
                    <PanelGroup direction="vertical" className="h-full">
                        {/* Header */}
                        <Panel defaultSize={8} minSize={6} maxSize={12} className="min-h-0">
                            <header className="h-full neu-inset-sm bg-background px-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => router.push('/onboarding')}
                                        className="neu-raised-sm neu-hover neu-active"
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2" />
                                        Back
                                    </Button>
                                    <div className="h-6 w-px bg-border" />
                                    <h1 className="font-semibold text-foreground text-soft-shadow">{projectName}</h1>
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
                                projectName={projectName}
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
                    <RightSidebar onMetadataUpdate={handleMetadataUpdate} projectName={projectName} />
                </Panel>
            </PanelGroup>
        </div>
    )
}
