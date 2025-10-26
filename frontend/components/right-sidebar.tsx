"use client"

import { useState } from "react"
import { Send, Sparkles, Bot, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FileAPI, ChatMessage } from "@/lib/api"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface RightSidebarProps {
  onMetadataUpdate?: () => void
  projectName?: string
}

export function RightSidebar({ onMetadataUpdate, projectName }: RightSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm your AI assistant. I can help you build and optimize your node workflows. What would you like to create?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>("")

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setStatusMessage("Thinking...")

    try {
      // Simulate different status messages
      const statusMessages = [
        "Analyzing your request...",
        "Generating nodes...",
        "Updating metadata...",
        "Almost done..."
      ]

      let statusIndex = 0
      const statusInterval = setInterval(() => {
        if (statusIndex < statusMessages.length) {
          setStatusMessage(statusMessages[statusIndex])
          statusIndex++
        }
      }, 800)

      // Convert messages to API format
      const apiMessages: ChatMessage[] = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      // Add the new user message
      apiMessages.push({
        role: "user",
        content: input
      })

      // Send to backend
      const response = await FileAPI.chat(apiMessages)

      clearInterval(statusInterval)
      setStatusMessage("")

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.message,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMessage])

      // Handle generated_nodes if present
      if (response.generated_nodes && response.generated_nodes.length > 0) {
        console.log("Generated nodes:", response.generated_nodes)
        // Trigger metadata update to refresh the canvas immediately
        if (onMetadataUpdate) {
          // Immediate update
          onMetadataUpdate()
          // Also update after a short delay to ensure backend has processed
          setTimeout(() => {
            onMetadataUpdate()
          }, 500)
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setStatusMessage("")
    }
  }

  return (
    <div className="h-full w-full neu-raised-sm bg-card flex flex-col">
      {/* Header */}
      <div className="h-12 neu-inset-sm border-b border-border flex items-center px-4 gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-foreground">AI Assistant</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`w-8 h-8 rounded-full neu-raised flex items-center justify-center shrink-0 ${message.role === "user" ? "bg-primary/10" : "bg-card"
                }`}
            >
              {message.role === "user" ? (
                <User className="w-4 h-4 text-primary" />
              ) : (
                <Bot className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className={`flex-1 ${message.role === "user" ? "text-right" : ""}`}>
              <div
                className={`inline-block neu-raised rounded-xl p-3 ${message.role === "user" ? "bg-primary/5" : "bg-card"
                  }`}
              >
                <p className="text-sm text-foreground">{message.content}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && statusMessage && (
          <div className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full neu-raised flex items-center justify-center shrink-0 bg-card">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <div className="inline-block neu-raised rounded-xl p-3 bg-card">
                <p className="text-sm text-muted-foreground">{statusMessage}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="px-4 pb-2">
        <div className="flex gap-2 flex-wrap">
          {["Add error handling", "Create data pipeline", "Optimize workflow"].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setInput(suggestion)}
              className="neu-raised-sm neu-hover neu-active bg-card px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="neu-inset bg-background rounded-xl p-2 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask me anything about your workflow..."
            className="flex-1 bg-transparent px-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Button
            onClick={handleSend}
            size="sm"
            className="neu-primary text-primary-foreground neu-hover neu-active shrink-0"
            disabled={isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
