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
  const terminalScrollRef = useRef<HTMLDivElement>(null)
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([])
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true)
  const workspace = "nody" // You can make this dynamic if needed

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [consoleMessages])

  // Auto-scroll terminal when new output arrives (only if already scrolled to bottom)
  useEffect(() => {
    if (terminalScrollRef.current && isScrolledToBottom) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight
    }
  }, [commandHistory, isScrolledToBottom])

  // Check if terminal is scrolled to bottom
  const handleTerminalScroll = () => {
    if (terminalScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = terminalScrollRef.current
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10 // 10px threshold
      setIsScrolledToBottom(isAtBottom)
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'SUCCESS': return 'text-green-400'
      case 'ERROR': return 'text-red-400'
      case 'DEBUG': return 'text-cyan-400'
      default: return 'text-primary'
    }
  }

  const executeCommand = async (command: string) => {
    console.log('executeCommand called with:', command)
    if (!command.trim()) return

    setCommandHistory(prev => [...prev, {
      command,
      output: 'Executing...'
    }])

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
      console.log('Executing command:', command, 'via', `${apiBaseUrl}/terminal/execute-stream`)

      // Always use streaming for real-time output
      const response = await fetch(`${apiBaseUrl}/terminal/execute-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      })

      console.log('Response status:', response.status, response.statusText)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedOutput = ''
      let accumulatedError = ''
      let chunkCount = 0

      console.log('=== Starting to read stream ===')

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('=== Stream finished ===')
          console.log('Final accumulated output length:', accumulatedOutput.length)
          break
        }

        chunkCount++
        const chunk = decoder.decode(value)
        console.log(`=== Chunk ${chunkCount} (${chunk.length} bytes) ===`)
        console.log('Raw chunk:', JSON.stringify(chunk))
        const lines = chunk.split('\n')
        console.log(`Split into ${lines.length} lines`)

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6)
              console.log('JSON string:', jsonStr)
              const data = JSON.parse(jsonStr)
              console.log('Parsed data:', data)
              if (data.output) {
                accumulatedOutput += data.output
                console.log('Accumulated output:', accumulatedOutput)
                // Force React to update by creating a new object
                setCommandHistory(prev => {
                  const newHistory = [...prev]
                  if (newHistory.length > 0) {
                    newHistory[newHistory.length - 1] = {
                      command,
                      output: accumulatedOutput,
                      error: accumulatedError || undefined
                    }
                  }
                  return newHistory
                })
              }
              if (data.error) {
                accumulatedError += data.error
                console.log('Accumulated error:', accumulatedError)
                // Update the command history with the error
                setCommandHistory(prev => {
                  const newHistory = [...prev]
                  if (newHistory.length > 0) {
                    newHistory[newHistory.length - 1] = {
                      command,
                      output: accumulatedOutput || undefined,
                      error: accumulatedError
                    }
                  }
                  return newHistory
                })
              }
              if (data.done) {
                console.log('Command finished')
                break
              }
            } catch (e) {
              console.error('JSON parse error:', e, 'for line:', line)
            }
          }
        }
      }
    } catch (error) {
      setCommandHistory(prev => {
        const updated = [...prev]
        const lastIndex = updated.length - 1
        let errorMessage = 'Command execution failed'

        if (error instanceof Error) {
          errorMessage = error.message
        }

        updated[lastIndex] = {
          command,
          error: errorMessage
        }
        return updated
      })
    }
  }

  return (
    <div className="h-full w-full neu-inset bg-background flex flex-col border-t-2 overflow-hidden">
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
              overflow: auto !important;
              display: flex !important;
              flex-direction: column !important;
              min-height: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            [data-terminal-wrapper] > div {
              flex: 1 1 auto !important;
              overflow: visible !important;
              max-height: none !important;
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
              max-height: none !important;
              overflow: visible !important;
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
          <div
            data-terminal-wrapper
            ref={terminalScrollRef}
            onScroll={handleTerminalScroll}
            style={{ height: '100%', maxHeight: '100%', overflow: 'auto' }}
          >
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
                    {item.output && item.output.split('\n').map((line, lineIdx) => (
                      <TerminalOutput key={lineIdx}>{line || '\u00A0'}</TerminalOutput>
                    ))}
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
