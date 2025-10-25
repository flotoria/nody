"use client"

import type React from "react"

import { useState } from "react"
import { Box, Database, Sparkles, Zap, Code, Settings, Code2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const nodeCategories = [
  { id: "logic", name: "Logic", icon: Code, color: "text-blue-400" },
  { id: "data", name: "Data", icon: Database, color: "text-green-400" },
  { id: "ai", name: "AI Models", icon: Sparkles, color: "text-purple-400" },
  { id: "api", name: "APIs", icon: Zap, color: "text-yellow-400" },
  { id: "utils", name: "Utilities", icon: Box, color: "text-cyan-400" },
]

const nodeTemplates = {
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
}

export function LeftSidebar({ selectedNode }: LeftSidebarProps) {
  const [selectedCategory, setSelectedCategory] = useState("logic")

  const handleDragStart = (e: React.DragEvent, nodeData: { label: string; type: string }) => {
    e.dataTransfer.setData("application/json", JSON.stringify(nodeData))
    e.dataTransfer.effectAllowed = "copy"
  }

  return (
    <div className="w-80 h-full shrink-0 neu-raised-sm bg-card flex flex-col">
      <Tabs defaultValue="nodes" className="flex-1 flex flex-col">
        <TabsList className="h-12 neu-inset-sm m-0 rounded-none border-b border-border">
          <TabsTrigger value="nodes" className="flex-1 data-[state=active]:neu-pressed">
            <Box className="w-4 h-4 mr-2" />
            Nodes
          </TabsTrigger>
          <TabsTrigger value="inspector" className="flex-1 data-[state=active]:neu-pressed">
            <Settings className="w-4 h-4 mr-2" />
            Inspector
          </TabsTrigger>
        </TabsList>

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
          {selectedNode ? (
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
                      <span className="text-sm text-foreground">AI Model</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Status</label>
                    <div className="neu-inset bg-background rounded px-3 py-2 mt-1 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm text-foreground">Ready</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="neu-raised bg-card rounded-xl p-4">
                <h3 className="font-semibold text-foreground mb-3 text-embossed">Parameters</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Model</label>
                    <select className="w-full neu-inset bg-background rounded px-3 py-2 mt-1 text-sm text-foreground">
                      <option>gpt-4</option>
                      <option>gpt-3.5-turbo</option>
                      <option>claude-3</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Temperature</label>
                    <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" className="w-full mt-2" />
                    <span className="text-xs text-muted-foreground">0.7</span>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Max Tokens</label>
                    <input
                      type="number"
                      defaultValue="2048"
                      className="w-full neu-inset bg-background rounded px-3 py-2 mt-1 text-sm text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div className="neu-raised bg-card rounded-xl p-4">
                <h3 className="font-semibold text-foreground mb-3 text-embossed">Metadata</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-foreground">2 hours ago</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Last Modified</span>
                    <span className="text-foreground">5 minutes ago</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Executions</span>
                    <span className="text-foreground">42</span>
                  </div>
                </div>
              </div>

              <div className="neu-raised bg-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Code2 className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground text-embossed">Generated Code</h3>
                </div>
                <div className="neu-inset bg-background rounded p-3">
                  <pre className="text-xs font-mono text-muted-foreground">
                    {`async function process() {
  const response = await ai({
    model: 'gpt-4',
    prompt: input
  })
  return response
}`}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full neu-raised bg-card mx-auto mb-4 flex items-center justify-center">
                  <Settings className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Select a node to view details</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
