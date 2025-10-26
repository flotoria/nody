"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { X, Loader2 } from "lucide-react"
import { FolderOpen } from "lucide-react"

type Template = {
  id: string
  name: string
  description: string
  metadata: {
    dateCreated: string
    lastModified: string
  }
}

const templates: Template[] = [
  {
    id: "hello-world",
    name: "simple todo tracker",
    description: "a minimal command-line todo list app to track tasks and learn python basics.",
    metadata: {
      dateCreated: "Oct 26, 2025",
      lastModified: "Oct 26, 2025"
    }
  },
  {
    id: "frontend-web",
    name: "personal portfolio website",
    description: "a modern portfolio site built with react to showcase your projects and skills.",
    metadata: {
      dateCreated: "Oct 26, 2025",
      lastModified: "Oct 26, 2025"
    }
  },
  {
    id: "data-pipeline",
    name: "csv data analyzer",
    description: "a python pipeline that reads, processes, and analyzes csv data files.",
    metadata: {
      dateCreated: "Oct 26, 2025",
      lastModified: "Oct 26, 2025"
    }
  },
  {
    id: "test",
    name: "test",
    description: "asdjioajsoesg",
    metadata: {
      dateCreated: "Oct 26, 2025",
      lastModified: "Oct 26, 2025"
    }
  }
]

interface TemplateSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (templateId: string) => void
  isLoading?: boolean
}

export function TemplateSelectionModal({ isOpen, onClose, onSelectTemplate, isLoading }: TemplateSelectionModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
    onSelectTemplate(templateId)
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card 
        className="w-full max-w-3xl mx-4 bg-background/95 backdrop-blur-xl border border-border/20 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">Existing Projects</CardTitle>
            <CardDescription className="mt-1">
              Choose an existing project
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 pb-6">
          {templates.map((template) => {
            const isSelected = selectedTemplate === template.id
            
            return (
              <Card
                key={template.id}
                className={`group cursor-pointer transition-all duration-300 border-2 ${
                  isSelected 
                    ? 'border-purple-500 shadow-lg shadow-purple-500/20 scale-[1.02]' 
                    : 'border-border hover:border-purple-500/50 hover:shadow-md'
                } bg-card/80 backdrop-blur hover:bg-card/90`}
                onClick={() => !isLoading && handleSelect(template.id)}
              >
                <CardContent className="py-4 flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected ? 'bg-purple-500/20 shadow-md' : 'bg-purple-500/10 group-hover:bg-purple-500/15'
                  }`}>
                    <FolderOpen className={`w-6 h-6 ${
                      isSelected ? 'text-purple-400' : 'text-purple-400/70 group-hover:text-purple-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-foreground">
                      {template.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {template.description}
                    </p>
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                      <span>Created: {template.metadata.dateCreated}</span>
                      <span>Modified: {template.metadata.lastModified}</span>
                    </div>
                  </div>
                  {isSelected && isLoading && (
                    <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                  )}
                </CardContent>
              </Card>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

