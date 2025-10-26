import { memo } from "react"
import { NodeProps } from "reactflow"
import { Button } from "@/components/ui/button"
import { FileText, Sparkles, Trash2 } from "lucide-react"
import { NodeHandles } from "./NodeHandles"
import { getCategoryColors } from "../utils/categoryColors"
import { NODE_WIDTH } from "../utils/constants"

export interface FileNodeData {
  kind: "file"
  fileId: string
  label: string
  fileType?: string
  filePath?: string
  status: string
  content?: string
  isModified?: boolean
  parentFolder?: string | null
  generating: boolean
  running: boolean
  description?: string
  category?: string
  onOpen: (id: string) => void
  onGenerate: (id: string) => void
  onRun?: (id: string) => void
  onStop?: (id: string) => void
  onDelete: (id: string) => void
}

export const FileNodeComponent = memo(({ id, data, selected, isConnectable }: NodeProps<FileNodeData>) => {
  const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1)
  const hasExistingContent = Boolean(data.content && data.content.trim().length > 0)
  const colors = getCategoryColors(data.category || "Files")
  
  // Treat as selected if it's actually selected OR if it's running globally
  const isGlowActive = selected || data.isRunning

  return (
    <div
      className="group relative rounded-2xl bg-gradient-to-br from-card/90 to-card/70 border border-border/20 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20"
      style={{ 
        width: NODE_WIDTH,
        borderColor: isGlowActive ? colors.primary : colors.border,
        boxShadow: isGlowActive 
          ? `0 0 0 2px ${colors.primary}40, 0 20px 40px -10px rgba(168, 85, 247, 0.4), 0 0 60px -20px rgba(168, 85, 247, 0.3)` 
          : '0 10px 30px -5px rgba(0, 0, 0, 0.2)',
        transform: isGlowActive ? 'translateY(-4px) scale(1.02)' : 'translateY(0)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <NodeHandles isConnectable={isConnectable} />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div 
              className="group-hover:animate-pulse flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 hover:scale-110"
              style={{ 
                backgroundColor: colors.bg,
                color: colors.text,
                boxShadow: selected ? `0 0 20px ${colors.primary}40` : 'none'
              }}
            >
              <FileText className="h-4 w-4 drop-shadow-sm" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground" title={data.label}>
                {data.label}
              </p>
              <p className="text-xs font-mono text-muted-foreground">{data.fileType || "text"}</p>
            </div>
          </div>
          {data.generating ? (
            <Sparkles 
              className="h-4 w-4 animate-spin" 
              style={{ color: colors.text }}
            />
          ) : null}
        </div>

        {data.category && (
          <span 
            className="inline-flex w-fit items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{ 
              backgroundColor: colors.bg,
              color: colors.text
            }}
          >
            {data.category}
          </span>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Status: <span className="font-medium text-foreground">{statusLabel}</span>
          </span>
          {data.parentFolder && (
            <span>
              Folder: <span className="font-medium text-foreground">{data.parentFolder}</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => data.onOpen(id)}
          >
            Open
          </Button>
          {hasExistingContent && !data.running && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-green-600"
              onClick={() => data.onRun?.(id)}
            >
              Run
            </Button>
          )}
          {hasExistingContent && data.running && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-red-600"
              onClick={() => data.onStop?.(id)}
            >
              Stop
            </Button>
          )}
          {!hasExistingContent && data.description && data.description.trim() && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              style={{ color: colors.text }}
              onClick={() => data.onGenerate(id)}
              disabled={data.generating}
            >
              Generate
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive"
            onClick={() => data.onDelete(id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
})

FileNodeComponent.displayName = "FileNodeComponent"

