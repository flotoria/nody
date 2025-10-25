"use client"

import { Play, Square, GitBranch, Search, Sparkles, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface TopNavProps {
  isRunning: boolean
  onToggleRun: () => void
}

export function TopNav({ isRunning, onToggleRun }: TopNavProps) {
  return (
    <div className="h-14 border-b border-border neu-flat bg-card flex items-center justify-between px-4 gap-4">
      {/* Left section - Project info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg neu-raised bg-primary/20 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground">NodeFlow Project</span>
        </div>
      </div>

      {/* Center section - Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Semantic node search (e.g., 'Find logic that handles user input')"
            className="pl-10 neu-pressed bg-background border-0 text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Right section - Controls */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="neu-flat neu-hover neu-active bg-card text-foreground">
          <Clock className="w-4 h-4 mr-2" />
          History
        </Button>

        <Button variant="ghost" size="sm" className="neu-flat neu-hover neu-active bg-card text-foreground">
          <Sparkles className="w-4 h-4 mr-2" />
          AI Assist
        </Button>

        <div className="w-px h-6 bg-border" />

        <Button
          onClick={onToggleRun}
          size="sm"
          className={`neu-flat neu-hover neu-active ${
            isRunning ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"
          }`}
        >
          {isRunning ? (
            <>
              <Square className="w-4 h-4 mr-2" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
