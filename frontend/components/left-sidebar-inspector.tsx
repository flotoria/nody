"use client"

import { Code2, Settings } from "lucide-react"
import type { FileNode, NodeMetadata } from "@/lib/api"

interface InspectorProps {
  selectedNode: string | null
  nodes: FileNode[]
  metadata: Record<string, NodeMetadata>
}

export function Inspector({ selectedNode, nodes, metadata }: InspectorProps) {
  if (!selectedNode) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full neu-raised bg-card mx-auto mb-4 flex items-center justify-center">
            <Settings className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Select a node to view details</p>
        </div>
      </div>
    )
  }

  const node = nodes.find((n) => n.id === selectedNode)
  const nodeMeta = metadata[selectedNode]

  if (!node && !nodeMeta) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No data found for selected node
      </div>
    )
  }

  return (
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
              <span className="text-sm text-foreground capitalize">
                {node?.type || nodeMeta?.type || "Unknown"}
              </span>
            </div>
          </div>
          {node?.fileType && (
            <div>
              <label className="text-xs text-muted-foreground">File Type</label>
              <div className="neu-inset bg-background rounded px-3 py-2 mt-1">
                <span className="text-sm text-foreground">{node.fileType}</span>
              </div>
            </div>
          )}
          {node?.filePath && (
            <div>
              <label className="text-xs text-muted-foreground">File Path</label>
              <div className="neu-inset bg-background rounded px-3 py-2 mt-1">
                <span className="text-sm font-mono text-foreground">{node.filePath}</span>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <div className="neu-inset bg-background rounded px-3 py-2 mt-1 flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  node?.status === "running"
                    ? "bg-blue-500"
                    : node?.status === "success"
                      ? "bg-green-500"
                      : node?.status === "failed"
                        ? "bg-red-500"
                        : "bg-gray-500"
                }`}
              />
              <span className="text-sm text-foreground capitalize">{node?.status || "idle"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="neu-raised bg-card rounded-xl p-4">
        <h3 className="font-semibold text-foreground mb-3 text-embossed">Metadata</h3>
        {nodeMeta ? (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Description</span>
              <span className="text-foreground text-right max-w-xs truncate">{nodeMeta.description}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Position X</span>
              <span className="text-foreground font-mono">{nodeMeta.x.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Position Y</span>
              <span className="text-foreground font-mono">{nodeMeta.y.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Coordinates</span>
              <span className="text-foreground font-mono">
                ({nodeMeta.x.toFixed(0)}, {nodeMeta.y.toFixed(0)})
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic">No metadata available</div>
        )}
      </div>

      {node?.content && (
        <div className="neu-raised bg-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Code2 className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-embossed">File Content Preview</h3>
          </div>
          <div className="neu-inset bg-background rounded p-3">
            <pre className="text-xs text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-48">
              {node.content.substring(0, 500)}
              {node.content.length > 500 && "..."}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

