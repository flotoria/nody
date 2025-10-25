"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Box, Database, Sparkles, Zap, Code, Settings, Code2, FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { FileNode, NodeMetadata } from "@/lib/api"
import { Inspector } from "@/components/left-sidebar-inspector"

const nodeCategories = [
  { id: "files", name: "Files", icon: FileText, color: "text-orange-400" },
  { id: "logic", name: "Logic", icon: Code, color: "text-blue-400" },
  { id: "data", name: "Data", icon: Database, color: "text-green-400" },
  { id: "ai", name: "AI Models", icon: Sparkles, color: "text-purple-400" },
  { id: "api", name: "APIs", icon: Zap, color: "text-yellow-400" },
  { id: "utils", name: "Utilities", icon: Box, color: "text-cyan-400" },
]

const nodeTemplates = {
  files: [
    { label: "New File", type: "file", isSpecial: true },
  ],
  logic: [
    { label: "If/Else", type: "logic" },
    { label: "Loop", type: "logic" },
    { label: "Switch", type: "logic" },
    { label: "Transform", type: "logic" },
  ],
  data: [
    { label: "Fetch Data", type: "data" },
    { label: "Store Data", type: "data" },
    { label: "Filter", type: "data" },
    { label: "Map", type: "data" },
  ],
  ai: [
    { label: "GPT-4", type: "ai" },
    { label: "Claude", type: "ai" },
    { label: "Embeddings", type: "ai" },
    { label: "Image Gen", type: "ai" },
  ],
  api: [
    { label: "REST Call", type: "api" },
    { label: "GraphQL", type: "api" },
    { label: "Webhook", type: "api" },
    { label: "WebSocket", type: "api" },
  ],
  utils: [
    { label: "Logger", type: "utils" },
    { label: "Timer", type: "utils" },
    { label: "Validator", type: "utils" },
    { label: "Parser", type: "utils" },
  ],
}

interface LeftSidebarProps {
  selectedNode: string | null
  nodes: FileNode[]
  metadata: Record<string, NodeMetadata>
  onCreateFile?: (fileName: string, fileType: string) => void
  onUpdateDescription?: (nodeId: string, description: string) => void
}

export function LeftSidebar({ selectedNode, nodes, metadata, onCreateFile, onUpdateDescription }: LeftSidebarProps) {
  const [selectedCategory, setSelectedCategory] = useState("files")
  const [activeTab, setActiveTab] = useState("nodes")

  // Auto-switch to inspector tab when a node is selected
  useEffect(() => {
    if (selectedNode) {
      setActiveTab("inspector")
    }
  }, [selectedNode])

  const handleDragStart = (e: React.DragEvent, nodeData: { label: string; type: string }) => {
    e.dataTransfer.setData("application/json", JSON.stringify(nodeData))
    e.dataTransfer.effectAllowed = "copy"
  }

  return (
    <div className="w-80 h-full shrink-0 neu-raised-sm bg-card flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="h-12 flex items-center justify-center border-b border-border">
          <TabsList className="h-8 w-fit neu-inset-sm">
            <TabsTrigger value="nodes" className="data-[state=active]:neu-pressed px-4">
              <Box className="w-4 h-4 mr-2" />
              Nodes
            </TabsTrigger>
            <TabsTrigger value="inspector" className="data-[state=active]:neu-pressed px-4">
              <Settings className="w-4 h-4 mr-2" />
              Inspector
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="nodes" className="flex-1 overflow-y-auto custom-scrollbar m-0">
          {/* Category selector */}
          <div className="p-4 border-b border-border">
            <div className="space-y-1">
              {nodeCategories.map((category) => {
                const Icon = category.icon
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                      selectedCategory === category.id
                        ? "neu-pressed bg-background"
                        : "neu-raised-sm neu-hover neu-active bg-card"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${category.color}`} />
                    <span className="text-sm font-medium text-foreground">{category.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-4 space-y-2">
            {nodeTemplates[selectedCategory as keyof typeof nodeTemplates]?.map((node) => (
              <div
                key={node.label}
                draggable
                onDragStart={(e) => handleDragStart(e, node)}
                className="neu-raised neu-hover neu-active bg-card p-3 rounded-xl cursor-move transition-all hover:scale-105"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-sm font-medium text-foreground">{node.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Drag to canvas</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inspector" className="flex-1 overflow-y-auto custom-scrollbar m-0">
          <Inspector selectedNode={selectedNode} nodes={nodes} metadata={metadata} onUpdateDescription={onUpdateDescription} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
