import { memo } from "react"
import { NodeProps } from "reactflow"
import { NodeHandles } from "./NodeHandles"
import { getCategoryColors } from "../utils/categoryColors"

export interface GenericNodeData {
  kind: "generic"
  label: string
  category: string
  isRunning?: boolean
}

export const GenericNodeComponent = memo(({ data, selected, isConnectable }: NodeProps<GenericNodeData>) => {
  const colors = getCategoryColors(data.category || "Custom")
  
  // Treat as selected if it's actually selected OR if it's running globally
  const isGlowActive = selected || data.isRunning
  
  return (
    <div
      className="group relative rounded-2xl border bg-gradient-to-br from-card/90 to-card/70 border-border/20 px-4 py-3 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20"
      style={{ 
        width: 220,
        borderColor: isGlowActive ? colors.primary : colors.border,
        boxShadow: isGlowActive 
          ? `0 0 0 2px ${colors.primary}40, 0 20px 40px -10px rgba(168, 85, 247, 0.4), 0 0 60px -20px rgba(168, 85, 247, 0.3)` 
          : '0 10px 30px -5px rgba(0, 0, 0, 0.2)',
        transform: isGlowActive ? 'translateY(-4px) scale(1.02)' : 'translateY(0)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <NodeHandles isConnectable={isConnectable} />
      <p 
        className="text-xs uppercase tracking-wide"
        style={{ color: colors.text }}
      >
        {data.category}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{data.label}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Placeholder node. Connect or convert this into concrete implementation.
      </p>
    </div>
  )
})

GenericNodeComponent.displayName = "GenericNodeComponent"

