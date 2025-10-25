"use client"

import type React from "react"

import { Sparkles, Database, Zap, ArrowRight, Trash2, FileText, ChevronDown, ChevronRight } from "lucide-react"
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
      className={`absolute cursor-move transition-all rounded-xl ${
        isSelected ? "neu-raised-xl ring-2 ring-primary scale-105" : "neu-raised-lg neu-hover neu-active"
      }`}
      style={{
        left: x,
        top: y,
        width: 192,
      }}
    >
      <div className="bg-card rounded-xl p-3">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg neu-raised-sm bg-card flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm text-foreground text-soft-shadow">{label}</span>
            {isModified && <span className="text-xs text-orange-400">●</span>}
          </div>
          <div className="flex items-center gap-2">
            {type === "file" && onExpand && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 neu-raised-sm neu-hover"
                onClick={(e) => {
                  e.stopPropagation()
                  onExpand(id)
                }}
              >
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </Button>
            )}
            <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
            {isSelected && onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 neu-raised-sm neu-hover"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(id)
                }}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {type !== "file" && (
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full neu-inset bg-background border border-primary/50 cursor-pointer hover:scale-125 transition-transform"
                onMouseUp={(e) => {
                  if (onConnectionEnd) {
                    onConnectionEnd(id, e)
                  }
                }}
              />
              <span className="text-xs text-muted-foreground">Input</span>
            </div>
          )}
        </div>

        <div className="neu-inset bg-background rounded-lg p-2 mb-3">
          <p className="text-xs text-muted-foreground font-mono">
            {type === "ai" && "model: gpt-4"}
            {type === "input" && "type: text"}
            {type === "output" && "format: json"}
            {type === "data" && "source: api"}
            {type === "file" && `type: ${fileType || "text"}`}
          </p>
        </div>

        <div className="space-y-2">
          {type !== "file" && (
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">Output</span>
              <div
                className="w-3 h-3 rounded-full neu-inset bg-background border border-primary/50 cursor-pointer hover:scale-125 transition-transform"
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
