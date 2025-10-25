"use client"

import { useState, useEffect, useRef } from "react"
import { Terminal, Users, Clock, X, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import TerminalUI, { ColorMode, TerminalOutput } from "react-terminal-ui"

interface ConsoleMessage {
  timestamp: string
  level: 'INFO' | 'SUCCESS' | 'ERROR' | 'DEBUG'
  message: string
}

interface CommandHistory {
  command: string
  output?: string
  error?: string
}

interface BottomDockProps {
  consoleMessages?: ConsoleMessage[]
}

export function BottomDock({ consoleMessages = [] }: BottomDockProps) {
  const allMessages = consoleMessages
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([])
  const workspace = "nody" // You can make this dynamic if needed

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [consoleMessages])

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'SUCCESS': return 'text-green-400'
      case 'ERROR': return 'text-red-400'
      case 'DEBUG': return 'text-cyan-400'
      default: return 'text-primary'
    }
  }

  const executeCommand = async (command: string) => {
    if (!command.trim()) return

    setCommandHistory(prev => [...prev, {
      command,
      output: 'Executing...'
    }])

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      })

      const data = await response.json()

      setCommandHistory(prev => {
        const updated = [...prev]
        const lastIndex = updated.length - 1
        updated[lastIndex] = {
          command,
          output: data.output || data.stdout || '',
          error: data.error || data.stderr
        }
        return updated
      })
    } catch (error) {
      setCommandHistory(prev => {
        const updated = [...prev]
        const lastIndex = updated.length - 1
        updated[lastIndex] = {
          command,
          error: error instanceof Error ? error.message : 'Command execution failed'
        }
        return updated
      })
    }
  }

  return (
    <div className="h-64 max-h-64 shrink-0 neu-inset bg-background flex flex-col border-t-2 overflow-hidden">
      <Tabs defaultValue="console" className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="h-12 flex items-center justify-between px-4 border-b border-border">
          <TabsList className="h-8 bg-transparent p-0 gap-1">
            <TabsTrigger value="console" className="data-[state=active]:neu-raised-sm data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">
              <Terminal className="w-4 h-4 mr-2" />
              Console
            </TabsTrigger>
            <TabsTrigger value="terminal" className="data-[state=active]:neu-raised-sm data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">
              <Users className="w-4 h-4 mr-2" />
              Terminal
            </TabsTrigger>
            <TabsTrigger value="timeline" className="data-[state=active]:neu-raised-sm data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20">
              <Clock className="w-4 h-4 mr-2" />
              Timeline
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 neu-hover">
              <X className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 neu-hover">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="console" className="flex-1 overflow-hidden m-0">
          <div className="h-full overflow-y-auto custom-scrollbar" ref={scrollAreaRef}>
            <div className="p-4 pt-2 space-y-2 font-mono text-xs">
              {allMessages.length === 0 ? (
                <div className="text-muted-foreground">No console output yet...</div>
              ) : (
                allMessages.map((msg, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-muted-foreground">[{msg.timestamp}]</span>
                    <span className={getLevelColor(msg.level)}>{msg.level}</span>
                    <span className="text-foreground">{msg.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="terminal" className="flex-1 overflow-hidden m-0 p-0 min-h-0" style={{ height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <style jsx global>{`
            [data-terminal-wrapper] {
              height: 100% !important;
              max-height: 100% !important;
              overflow: hidden !important;
              display: flex !important;
              flex-direction: column !important;
              min-height: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            [data-terminal-wrapper] > div {
              flex: 1 1 auto !important;
              overflow: auto !important;
              max-height: 100% !important;
              min-height: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            /* Remove all padding from terminal container and its children */
            [data-terminal-wrapper] .terminal-container,
            [data-terminal-wrapper] .terminal-container *,
            [data-terminal-wrapper] > div > div {
              padding: 0 !important;
              margin: 0 !important;
            }
            [data-terminal-wrapper] .terminal-output {
              font-size: 12px !important;
              color: hsl(var(--foreground)) !important;
              padding: 0 !important;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            }
            [data-terminal-wrapper] input {
              font-size: 12px !important;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
              color: hsl(var(--foreground)) !important;
              background: transparent !important;
              padding: 0 !important;
              border: none !important;
              outline: none !important;
            }
            /* Force font size on all terminal text */
            [data-terminal-wrapper] * {
              font-size: 12px !important;
            }
            /* Match terminal background to console */
            .terminal-container,
            [data-terminal-wrapper] .terminal-container,
            [data-terminal-wrapper] > div,
            [data-terminal-wrapper] > div > div {
              max-height: 100% !important;
              overflow: hidden !important;
              background: hsl(var(--background)) !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            /* Terminal text colors to match console */
            [data-terminal-wrapper],
            [data-terminal-wrapper] * {
              color: hsl(var(--foreground)) !important;
            }
            /* Match console layout */
            [data-terminal-wrapper] .terminal-output {
              padding-left: 0 !important;
              padding-right: 0 !important;
              padding-top: 0 !important;
              padding-bottom: 0 !important;
            }
            /* Hide terminal window control buttons (red, yellow, green) */
            [data-terminal-wrapper] .terminal-window-controls,
            [data-terminal-wrapper] button:first-child,
            [data-terminal-wrapper] > div > div:first-child,
            [data-terminal-wrapper] .terminal-header button {
              display: none !important;
            }
          `}</style>
          <div data-terminal-wrapper style={{ height: '100%', maxHeight: '100%' }}>
            <TerminalUI
              name=""
              colorMode={ColorMode.Dark}
              onInput={(input) => executeCommand(input)}
              height="100%"
            >
              {commandHistory.length === 0 ? (
                <TerminalOutput>Terminal ready. Type a command and press Enter...</TerminalOutput>
              ) : (
                commandHistory.map((item, idx) => (
                  <div key={idx}>
                    <TerminalOutput>$ {item.command}</TerminalOutput>
                    {item.output && <TerminalOutput>{item.output}</TerminalOutput>}
                    {item.error && <TerminalOutput><span className="text-red-500">{item.error}</span></TerminalOutput>}
                  </div>
                ))
              )}
            </TerminalUI>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full custom-scrollbar">
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                <div>
                  <div className="text-sm text-foreground">Node created</div>
                  <div className="text-xs text-muted-foreground">2 minutes ago</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5" />
                <div>
                  <div className="text-sm text-foreground">Connection established</div>
                  <div className="text-xs text-muted-foreground">5 minutes ago</div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
