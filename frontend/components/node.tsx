"use client"

import type React from "react"

import { Sparkles, Database, Zap, ArrowRight, Trash2, FileText, ChevronDown, ChevronRight, Code2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NodeProps {
  id: string
  type: string
  label: string
  x: number
  y: number
  status: "idle" | "running" | "success" | "failed"
  isSelected: boolean
  onSelect: () => void
  onDragStart?: (nodeId: string, e: React.MouseEvent) => void
  onDelete?: (nodeId: string) => void
  onConnectionStart?: (nodeId: string, e: React.MouseEvent) => void
  onConnectionEnd?: (nodeId: string, e: React.MouseEvent) => void
  // File-specific props
  filePath?: string
  fileType?: string
  content?: string
  isExpanded?: boolean
  isModified?: boolean
  onExpand?: (nodeId: string) => void
  onGenerateCode?: (nodeId: string) => void
  isGenerating?: boolean
  // Drawing mode props
  isDrawingMode?: boolean
  isDrawingSource?: boolean
  isDrawingTarget?: boolean
}

const nodeIcons = {
  input: ArrowRight,
  ai: Sparkles,
  data: Database,
  api: Zap,
  output: ArrowRight,
  file: FileText,
}

const statusColors = {
  idle: "bg-muted",
  running: "bg-primary animate-pulse",
  success: "bg-green-500",
  failed: "bg-destructive",
}

export function Node({
  id,
  type,
  label,
  x,
  y,
  status,
  isSelected,
  onSelect,
  onDragStart,
  onDelete,
  onConnectionStart,
  onConnectionEnd,
  filePath,
  fileType,
  content,
  isExpanded,
  isModified,
  onExpand,
  onGenerateCode,
  isGenerating,
  isDrawingMode = false,
  isDrawingSource = false,
  isDrawingTarget = false,
}: NodeProps) {
  const Icon = nodeIcons[type as keyof typeof nodeIcons] || ArrowRight

  return (
    <div
      onClick={onSelect}
      onMouseDown={(e) => {
        if (e.button === 0 && onDragStart) {
          onDragStart(id, e)
        }
      }}
      className={`absolute transition-all duration-200 rounded-2xl ${
        isDrawingMode 
          ? isDrawingSource
            ? "shadow-2xl ring-2 ring-green-500/50 scale-105 bg-gradient-to-br from-green-500/10 to-green-500/5 cursor-pointer"
            : isDrawingTarget
            ? "shadow-xl ring-2 ring-blue-500/50 scale-102 bg-gradient-to-br from-blue-500/10 to-blue-500/5 cursor-pointer"
            : "shadow-lg ring-1 ring-primary/30 scale-101 bg-gradient-to-br from-card/95 to-card/80 cursor-pointer hover:shadow-xl hover:scale-102"
          : isSelected 
          ? "shadow-2xl ring-2 ring-primary/50 scale-105 bg-gradient-to-br from-card to-card/80 cursor-move" 
          : "shadow-lg hover:shadow-xl hover:scale-102 bg-gradient-to-br from-card/95 to-card/80 hover:from-card to-card/90 cursor-move"
      }`}
      style={{
        left: x,
        top: y,
        width: 280,
        backdropFilter: "blur(10px)",
      }}
    >
      <div className="bg-gradient-to-br from-card/90 to-card/70 rounded-2xl p-5 border border-border/20">
        <div className="mb-4 pb-3 border-b border-border/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20 shadow-sm flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-semibold text-sm text-foreground truncate" title={label}>{label}</span>
                {fileType && (
                  <span className="text-xs text-muted-foreground font-mono">{fileType}</span>
                )}
              </div>
              {isModified && <span className="text-xs text-orange-400 animate-pulse flex-shrink-0">●</span>}
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            {type === "file" && onExpand && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 rounded-md bg-background/50 hover:bg-background/80 border border-border/20 hover:border-border/40 transition-all"
                onClick={(e) => {
                  e.stopPropagation()
                  onExpand(id)
                }}
              >
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </Button>
            )}
            {type === "file" && onGenerateCode && (!content || content.trim() === "") && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 rounded-md bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 transition-all"
                onClick={(e) => {
                  e.stopPropagation()
                  onGenerateCode(id)
                }}
                disabled={isGenerating}
                title={isGenerating ? "Generating code..." : "Generate code from description"}
              >
                {isGenerating ? (
                  <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-purple-400" />
                )}
              </Button>
            )}
            <div className={`w-3 h-3 rounded-full ${statusColors[status]} shadow-sm`} />
            {isSelected && onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-all"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(id)
                }}
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-3">
          {type !== "file" && (
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40 cursor-pointer hover:scale-125 hover:border-primary/60 transition-all shadow-sm"
                onMouseUp={(e) => {
                  if (onConnectionEnd) {
                    onConnectionEnd(id, e)
                  }
                }}
              />
              <span className="text-xs text-muted-foreground font-medium">Input</span>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-background/60 to-background/40 rounded-xl p-3 mb-3 border border-border/10">
          <p className="text-xs text-muted-foreground font-mono">
            {type === "ai" && "🤖 model: gpt-4"}
            {type === "input" && "📥 type: text"}
            {type === "output" && "📤 format: json"}
            {type === "data" && "🗄️ source: api"}
            {type === "file" && `📄 type: ${fileType || "text"}`}
          </p>
        </div>

        <div className="space-y-3">
          {type !== "file" && (
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground font-medium">Output</span>
              <div
                className="w-4 h-4 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/40 cursor-pointer hover:scale-125 hover:border-primary/60 transition-all shadow-sm"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  if (onConnectionStart) {
                    onConnectionStart(id, e)
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
