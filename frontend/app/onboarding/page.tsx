"use client"

import { useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FolderOpen, Bot } from "lucide-react"
import RaysBackground from "@/components/rays-background"
import Image from "next/image"

type Message = { role: "user" | "assistant"; content: string }

export default function OnboardingPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Tell me about the project you want to build, and I'll ask a couple of quick questions before generating it.",
    },
  ])
  const [input, setInput] = useState("")
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleChooseFolder = () => {
    fileInputRef.current?.click()
  }

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    alert(`Selected ${files.length} file(s). Project import placeholder.`)
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setMessages((prev) => [...prev, { role: "user", content: text }])
    setInput("")

    // Simple staged follow-up flow
    setTimeout(() => {
      if (step === 0) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Great. What language or framework should we use?" },
        ])
        setStep(1)
      } else if (step === 1) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Do you need authentication and user accounts?" },
        ])
        setStep(2)
      } else if (step === 2) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Any integrations or data sources to connect?" },
        ])
        setStep(3)
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Perfect. I'm ready to generate your project." },
        ])
        setReady(true)
      }
    }, 400)
  }

  const handleGenerate = () => {
    alert("Generating project based on the conversation... (demo)")
  }

  return (
    <div className="min-h-screen relative flex flex-col bg-background text-foreground">
      <RaysBackground
        className="pointer-events-none absolute inset-0 z-0 opacity-30"
        raysColor={{ mode: "multi", color1: "#FFFFFF", color2: "#6EA8FF" }}
        intensity={30}
        rays={24}
        reach={32}
        position={50}
        vertical={-30}
        gridColor="#FFFFFF"
        gridThickness={1}
        gridOpacity={0.16}
        gridBlur={1.2}
      />
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">

        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="text-center mb-8 relative">
            <div className="inline-block mx-auto logo-shine">
              <Image
                src="/nody.png"
                alt="Nody"
                width={720}
                height={220}
                priority
                className="mx-auto h-32 md:h-44 lg:h-52 xl:h-60 w-auto logo-glow"
              />
            </div>
            <p className="text-muted-foreground mt-0.5 text-xl md:text-2xl font-semibold">AI Native Visual Development Environment</p>
          </div>
          {/* Separator under hero removed per request */}

        <Card role="button" aria-label="Load an existing project" onClick={handleChooseFolder} className="group neu-raised neu-hover neu-hover-strong neu-active hover-glow-primary bg-card/80 backdrop-blur border px-4 cursor-pointer transition-all">
          <CardContent className="py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg neu-raised neu-icon-hover neu-active bg-primary/15 flex items-center justify-center shrink-0">
                <FolderOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-base font-semibold">Open Existing Project</div>
                <div className="text-xs text-muted-foreground">Load an existing project from your computer.</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                // @ts-expect-error - Non-standard but supported in Chromium-based browsers
                webkitdirectory=""
                multiple
                className="hidden"
                onChange={handleFilesChosen}
              />
            </div>
          </CardContent>
        </Card>

        <div className="relative my-8">
          <Separator />
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2">
            <div className="px-3 py-1 rounded-full text-[10px] bg-card border text-muted-foreground shadow-sm">OR</div>
          </div>
        </div>

        <Card className="group neu-raised neu-hover neu-hover-strong neu-active hover-glow-primary bg-card/80 backdrop-blur border px-4 transition-all">
          <CardHeader className="gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg neu-raised neu-icon-hover neu-active bg-primary/15 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Generate Project</CardTitle>
                <CardDescription>Describe your workflow and answer a few follow-up questions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pb-6">
            <div className="border rounded-md neu-inset-xs">
              <ScrollArea className="h-64 p-4">
                <div className="space-y-3">
                  {messages.map((m, i) => (
                    <div key={i} className={`flex items-start gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      {m.role === "assistant" && (
                        <div className="mt-0.5 text-muted-foreground">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
                          m.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <form onSubmit={handleSend} className="border-t p-3 flex items-end gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your app..."
                  className="flex-1"
                />
                <Button type="submit" className="neu-raised-sm neu-hover" disabled={!input.trim()}>
                  Send
                </Button>
              </form>
            </div>
            <Button onClick={handleGenerate} className="w-full neu-primary neu-hover" disabled={!ready}>
              Generate Project
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}
