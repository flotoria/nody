"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FolderOpen, Bot, FileText, RefreshCcw, CheckCircle2, Plus } from "lucide-react"
import RaysBackground from "@/components/rays-background"
import Image from "next/image"
import { useRouter } from "next/navigation"
import NodyInitial from "@/assets/nody_initial.png"
import NodyLogo from "@/assets/nody.png"
import { FileAPI, OnboardingAPI, ProjectSpec } from "@/lib/api"

type ChatBubble = {
  id: string
  role: "user" | "assistant"
  content: string
}

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `msg_${Math.random().toString(36).slice(2, 10)}`
}

const listOrFallback = (items: string[]) => {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No items captured yet.</p>
  }
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  )
}

const AcceptanceCriteria = ({ criteria }: { criteria: string[] }) => {
  if (!criteria.length) return null
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
      {criteria.map((criterion, index) => (
        <li key={`${criterion}-${index}`}>{criterion}</li>
      ))}
    </ul>
  )
}

export default function OnboardingPage() {
  const [messages, setMessages] = useState<ChatBubble[]>(() => [
    {
      id: createId(),
      role: "assistant",
      content: "Tell me about the project you want to build, and I'll ask any follow-up questions I need.",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [projectSpec, setProjectSpec] = useState<ProjectSpec | null>(null)
  const [missingInformation, setMissingInformation] = useState<string[]>([])
  const [status, setStatus] = useState<"collecting" | "ready">("collecting")
  const [errorMessage, setErrorMessage] = useState("")
  const [isChatVisible, setIsChatVisible] = useState(true)
  const [initialFetchComplete, setInitialFetchComplete] = useState(false)
  const [selectedFolderCount, setSelectedFolderCount] = useState<number | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const sessionId = useMemo(() => createId(), [])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!scrollContainerRef.current) return
    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
  }, [messages, isChatVisible])

  useEffect(() => {
    let mounted = true
    const loadExistingSpec = async () => {
      try {
        const existing = await OnboardingAPI.getProjectSpec()
        if (!mounted) return
        if (existing.exists && existing.project_spec) {
          setProjectSpec(existing.project_spec)
          setStatus("ready")
          setIsChatVisible(false)
        }
      } catch (error) {
        console.error("Failed to load existing project spec:", error)
      } finally {
        if (mounted) {
          setInitialFetchComplete(true)
        }
      }
    }

    loadExistingSpec()
    return () => {
      mounted = false
    }
  }, [])

  const [availableProjects, setAvailableProjects] = useState<Array<{ name: string; path: string; lastModified: string; fileCount: number }>>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [showProjectNameModal, setShowProjectNameModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")

  const loadAvailableProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setAvailableProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoadingProjects(false)
    }
  }

  useEffect(() => {
    loadAvailableProjects()
  }, [])

  const handleOpenProject = (projectName: string) => {
    router.push(`/p/${projectName}`)
  }

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!input.trim() || isLoading) return

    setErrorMessage("")
    const userMessage: ChatBubble = {
      id: createId(),
      role: "user",
      content: input.trim(),
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput("")
    setIsLoading(true)

    try {
      const conversation = nextMessages.map(({ role, content }) => ({ role, content }))
      const response = await OnboardingAPI.chat(sessionId, conversation)

      setMissingInformation(response.missing_information || [])
      setStatus(response.status)

      const assistantReply: ChatBubble = {
        id: createId(),
        role: "assistant",
        content: response.message,
      }
      setMessages(prev => [...prev, assistantReply])

      if (response.status === "ready" && response.project_spec) {
        setProjectSpec(response.project_spec)
        setIsChatVisible(false)
      }
    } catch (error) {
      console.error("Failed to process onboarding chat:", error)
      setErrorMessage("Something went wrong. Please try again.")
      const fallbackMessage: ChatBubble = {
        id: createId(),
        role: "assistant",
        content: "I ran into a problem processing that. Could you try again or clarify the last details?",
      }
      setMessages(prev => [...prev, fallbackMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeepIterating = () => {
    setIsChatVisible(true)
    setProjectSpec(null)
    setStatus("collecting")
    setMissingInformation([])
    const encouragement: ChatBubble = {
      id: createId(),
      role: "assistant",
      content: "Absolutely, let me know what you'd like to adjust or add to the project specification.",
    }
    setMessages(prev => [...prev, encouragement])
  }

  const handleGenerate = async () => {
    if (!projectSpec) {
      window.alert("I need a confirmed project specification before generating files.")
      return
    }
    setIsGenerating(true)
    try {
      const preparation = await OnboardingAPI.prepareProject()
      if (!preparation.files_created) {
        window.alert("The planner could not create any files from the spec. Please refine the requirements and try again.")
        return
      }

      // Get the project name from the preparation response
      const projectName = preparation.project_name || 'generated-project'

      const result = await FileAPI.runProject()
      if (!result.success) {
        window.alert("Project generation did not start. Please review the output panel for more details.")
        return
      }

      window.alert(`${preparation.message} Redirecting you to the workspace...`)
      router.push(`/p/${projectName}`)
    } catch (error) {
      console.error("Failed to trigger project generation:", error)

      // Check if the error is because project already exists
      if (error.message.includes("already exists")) {
        // Extract project name from error message
        const match = error.message.match(/Project '([^']+)' already exists/)
        if (match) {
          const existingProjectName = match[1]
          window.alert(`Project '${existingProjectName}' already exists. Redirecting to existing project...`)
          router.push(`/p/${existingProjectName}`)
          return
        }
      }

      window.alert("Unable to start project generation. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleStartEmpty = () => {
    setShowProjectNameModal(true)
  }

  const handleCreateEmptyProject = async () => {
    if (!newProjectName.trim()) {
      window.alert("Please enter a project name")
      return
    }

    // Validate project name (no spaces, special characters)
    const sanitizedName = newProjectName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
    if (sanitizedName !== newProjectName.trim()) {
      window.alert("Project name can only contain letters, numbers, underscores, and hyphens")
      return
    }

    // Additional validation
    if (sanitizedName === 'undefined' || sanitizedName === 'null' || sanitizedName === '') {
      window.alert("Please enter a valid project name")
      return
    }

    console.log('Creating project with name:', sanitizedName)

    try {
      // Create project directory and basic files
      const response = await fetch(`/api/projects/${sanitizedName}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: sanitizedName })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to create project')
      }

      // Navigate to the new project
      router.push(`/p/${sanitizedName}`)
    } catch (error) {
      console.error("Failed to create project:", error)
      window.alert(`Unable to create project: ${error.message}`)
    } finally {
      setShowProjectNameModal(false)
      setNewProjectName("")
    }
  }

  const renderTechnicalStack = (spec: ProjectSpec) => (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frontend</p>
        <p className="text-sm text-foreground">{spec.technical_stack.frontend || "Not specified"}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Backend</p>
        <p className="text-sm text-foreground">{spec.technical_stack.backend || "Not specified"}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">API</p>
        <p className="text-sm text-foreground">{spec.technical_stack.api || "Not specified"}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Database</p>
        <p className="text-sm text-foreground">{spec.technical_stack.database || "Not specified"}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Infrastructure</p>
        <p className="text-sm text-foreground">{spec.technical_stack.infrastructure || "Not specified"}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3rd Party Services</p>
        {listOrFallback(spec.technical_stack.third_party_services)}
      </div>
    </div>
  )

  const renderFeatureHighlights = (spec: ProjectSpec) => {
    if (!spec.primary_features.length) {
      return <p className="text-sm text-muted-foreground">No primary features captured yet.</p>
    }

    return (
      <div className="space-y-4">
        {spec.primary_features.map(feature => (
          <div key={feature.name} className="rounded-lg border border-border bg-card/60 p-4 shadow-sm">
            <p className="text-sm font-semibold text-foreground">{feature.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
            <AcceptanceCriteria criteria={feature.acceptance_criteria} />
          </div>
        ))}
      </div>
    )
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
                src={NodyLogo}
                alt="Nody"
                width={720}
                height={220}
                priority
                className="mx-auto h-32 md:h-44 lg:h-52 xl:h-60 w-auto logo-glow"
              />
            </div>
            <p className="text-muted-foreground mt-0.5 text-xl md:text-2xl font-semibold">
              AI Native Visual Development Environment
            </p>
          </div>

          <Card className="group neu-raised neu-hover neu-hover-strong neu-active hover-glow-primary bg-card/80 backdrop-blur border px-4 transition-all">
            <CardHeader className="gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg neu-raised neu-icon-hover neu-active bg-primary/15 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Available Projects</CardTitle>
                  <CardDescription>
                    Open an existing project from your workspace.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              {loadingProjects ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading projects...</p>
                </div>
              ) : availableProjects.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No projects found</h3>
                  <p className="text-muted-foreground">
                    No existing projects found in your workspace. Create a new project below.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {availableProjects.map((project) => (
                    <Card
                      key={project.name}
                      role="button"
                      aria-label={`Open project ${project.name}`}
                      onClick={() => handleOpenProject(project.name)}
                      className="group neu-raised-sm neu-hover neu-active hover-glow-primary bg-card/60 backdrop-blur border px-4 cursor-pointer transition-all"
                    >
                      <CardContent className="py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg neu-raised-sm neu-icon-hover neu-active bg-primary/15 flex items-center justify-center shrink-0">
                            <FolderOpen className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{project.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {project.fileCount} files • Modified {new Date(project.lastModified).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="neu-raised-sm neu-hover neu-active">
                            Open
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="relative my-8">
            <Separator />
            <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2">
              <div className="px-3 py-1 rounded-full text-[10px] bg-card border text-muted-foreground shadow-sm">OR</div>
            </div>
          </div>

          <Card
            role="button"
            aria-label="Start with empty project"
            onClick={handleStartEmpty}
            className="group neu-raised neu-hover neu-hover-strong neu-active hover-glow-primary bg-card/80 backdrop-blur border px-4 cursor-pointer transition-all"
          >
            <CardContent className="py-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg neu-raised neu-icon-hover neu-active bg-primary/15 flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-base font-semibold">Start with Empty Project</div>
                  <div className="text-xs text-muted-foreground">
                    Begin with a clean canvas and build your project from scratch.
                  </div>
                </div>
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
                  <CardDescription>
                    Describe your workflow and answer the assistant&apos;s follow-up questions to build a complete spec.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              {isChatVisible ? (
                <>
                  <div className="border rounded-md neu-inset-xs">
                    <ScrollArea className="h-64 p-4">
                      <div ref={scrollContainerRef} className="space-y-3">
                        {messages.map(message => (
                          <div
                            key={message.id}
                            className={`flex items-start gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            {message.role === "assistant" && (
                              <div className="self-end mb-0.5 w-6 h-6 rounded-full ring-1 ring-border bg-card/60 flex items-center justify-center p-0.5">
                                <Image
                                  src={NodyInitial}
                                  alt="Nody"
                                  width={16}
                                  height={16}
                                  className="w-4 h-4 object-contain"
                                />
                              </div>
                            )}
                            <div className={`relative max-w-[80%] rounded-lg px-4 py-3 text-sm ${message.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-none"
                              : "bg-neutral-900 text-neutral-100 border border-border shadow-sm rounded-bl-none"
                              }`}>
                              {message.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <form onSubmit={handleSend} className="border-t p-3 flex items-end gap-2">
                      <Input
                        value={input}
                        onChange={event => setInput(event.target.value)}
                        placeholder="Describe your app..."
                        className="flex-1"
                        disabled={isLoading}
                      />
                      <Button type="submit" className="neu-raised-sm neu-hover" disabled={!input.trim() || isLoading}>
                        {isLoading ? "Thinking..." : "Send"}
                      </Button>
                    </form>
                  </div>

                  {missingInformation.length > 0 && (
                    <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Still need:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {missingInformation.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {missingInformation.length === 0 && status === "collecting" && (
                    <p className="text-xs text-muted-foreground">
                      I&apos;ll keep asking questions until I have everything required for the spec.
                    </p>
                  )}

                  {errorMessage && (
                    <p className="text-sm text-destructive">
                      {errorMessage}
                    </p>
                  )}
                </>
              ) : initialFetchComplete && projectSpec ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-foreground font-medium">Project specification ready.</span>
                  </div>
                  <div className="rounded-lg border border-border bg-card/60 p-4 shadow-sm">
                    <div className="flex items-start gap-2">
                      <FileText className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{projectSpec.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{projectSpec.summary}</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Goals</p>
                        {listOrFallback(projectSpec.goals)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target Users</p>
                        {listOrFallback(projectSpec.target_users)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary Features</p>
                        {renderFeatureHighlights(projectSpec)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Technical Stack</p>
                        {renderTechnicalStack(projectSpec)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Integrations</p>
                        {listOrFallback(projectSpec.integrations)}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Non-Functional Requirements</p>
                          {listOrFallback(projectSpec.non_functional_requirements)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Constraints</p>
                          {listOrFallback(projectSpec.constraints)}
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Success Metrics</p>
                          {listOrFallback(projectSpec.success_metrics)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open Questions</p>
                          {listOrFallback(projectSpec.open_questions)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={handleGenerate}
                      className="w-full neu-primary neu-hover"
                      disabled={isGenerating}
                    >
                      {isGenerating ? "Generating..." : "Generate Project"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleKeepIterating}
                      className="w-full neu-raised-sm neu-hover flex items-center justify-center gap-2"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Keep Iterating
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Preparing assistant...</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Project Name Modal */}
      {showProjectNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create New Project</CardTitle>
              <CardDescription>
                Enter a name for your new empty project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="my-awesome-project"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateEmptyProject()
                  }
                }}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowProjectNameModal(false)
                    setNewProjectName("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateEmptyProject}
                  disabled={!newProjectName.trim()}
                >
                  Create Project
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
