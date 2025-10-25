"use client"

import { Terminal, Users, Clock, X, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useRef } from "react"

interface ConsoleMessage {
  timestamp: string
  level: 'INFO' | 'SUCCESS' | 'ERROR' | 'DEBUG'
  message: string
}

interface BottomDockProps {
  consoleMessages?: ConsoleMessage[]
}

export function BottomDock({ consoleMessages = [] }: BottomDockProps) {
  const allMessages = consoleMessages
  const scrollAreaRef = useRef<HTMLDivElement>(null)

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
  return (
    <div className="h-64 shrink-0 neu-inset bg-background flex flex-col">
      <Tabs defaultValue="console" className="flex-1 flex flex-col">
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

        <TabsContent value="terminal" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full custom-scrollbar">
            <div className="p-4 font-mono text-xs text-foreground">
              <div>$ npm run dev</div>
              <div className="text-muted-foreground mt-2">Server running on http://localhost:3000</div>
            </div>
          </ScrollArea>
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
