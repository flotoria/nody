import { memo } from "react"
import { NodeProps } from "reactflow"
import { Button } from "@/components/ui/button"
import { Folder as FolderIcon, Trash2 } from "lucide-react"
import { NodeHandles } from "./NodeHandles"
import { getCategoryColors } from "../utils/categoryColors"
import { NodeResizer } from "reactflow"

export interface FolderNodeData {
  kind: "folder"
  folderId: string
  name: string
  width: number
  height: number
  isExpanded: boolean
  containedFiles: string[]
  isHovered?: boolean
  isRunning?: boolean
  onDelete?: (id: string) => void
}

export const FolderNodeComponent = memo(({ data, selected, isConnectable }: NodeProps<FolderNodeData>) => {
  const height = data.isExpanded ? data.height : 96 // FOLDER_COLLAPSED_HEIGHT
  const colors = getCategoryColors("Files") // Folders are always in the Files category
  
  // Treat as selected if it's actually selected OR if it's running globally
  const isGlowActive = selected || data.isRunning

  return (
    <div
      className="group relative rounded-2xl border-2 bg-gradient-to-br from-card/90 to-card/70 border-border/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/20"
      style={{ 
        width: data.width, 
        height,
        borderColor: isGlowActive ? colors.primary : colors.border,
        boxShadow: isGlowActive 
          ? `0 20px 40px -10px rgba(168, 85, 247, 0.4), 0 0 60px -20px rgba(168, 85, 247, 0.3)` 
          : '0 10px 30px -5px rgba(0, 0, 0, 0.2)',
        transform: isGlowActive ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <NodeResizer
        color={colors.primary}
        isVisible={selected}
        minWidth={300}
        minHeight={200}
        handleStyle={{
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          backgroundColor: colors.primary,
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
        lineStyle={{
          borderColor: colors.primary,
          borderWidth: '2px',
        }}
      />
      <NodeHandles isConnectable={isConnectable} />
      <div className="flex h-full flex-col">
        <div 
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ 
            borderColor: colors.border,
            backgroundColor: colors.bg
          }}
        >
          <div 
            className="group-hover:animate-pulse flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 hover:scale-110"
            style={{ 
              backgroundColor: colors.bg,
              color: colors.text,
              boxShadow: selected ? `0 0 20px ${colors.primary}40` : 'none'
            }}
          >
            <FolderIcon className="h-4 w-4 drop-shadow-sm" />
          </div>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-semibold text-foreground">{data.name}</span>
            <span className="text-xs text-muted-foreground">
              {data.containedFiles.length} file{data.containedFiles.length === 1 ? "" : "s"}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive/80"
            onClick={() => data.onDelete?.(data.folderId)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {data.isExpanded ? (
          <div className="flex-1 px-4 py-3 text-xs text-muted-foreground">
            Drag files into this region to organize them.
          </div>
        ) : (
          <div className="flex-1 px-4 py-3 text-xs text-muted-foreground italic">
            Folder collapsed
          </div>
        )}
      </div>
    </div>
  )
})

FolderNodeComponent.displayName = "FolderNodeComponent"

