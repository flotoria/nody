"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface NodeConfigurationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfigure: (config: NodeConfiguration) => void
  nodeType: string
  initialPosition?: { x: number; y: number }
  initialValues?: Partial<NodeConfiguration> & { fileType?: string; fileName?: string }
}

export interface NodeConfiguration {
  label: string
  description: string
  category: string
  fileType?: string
  fileName?: string
}

const NODE_TYPES = [
  { value: "AI / ML Boilerplates", label: "AI / ML Boilerplates" },
  { value: "Web & API", label: "Web & API" },
  { value: "Backend Logic", label: "Backend Logic" },
  { value: "Database & Data Flow", label: "Database & Data Flow" },
  { value: "DevOps & Infra", label: "DevOps & Infra" },
  { value: "Frontend / UI", label: "Frontend / UI" },
  { value: "Security & Auth", label: "Security & Auth" },
  { value: "Utility / Common", label: "Utility / Common" },
  { value: "file", label: "File" },
  { value: "folder", label: "Folder" },
  { value: "custom", label: "Custom" },
]

const FILE_TYPES = [
  { value: "python", label: "Python (.py)" },
  { value: "javascript", label: "JavaScript (.js)" },
  { value: "typescript", label: "TypeScript (.ts)" },
  { value: "html", label: "HTML (.html)" },
  { value: "css", label: "CSS (.css)" },
  { value: "json", label: "JSON (.json)" },
  { value: "markdown", label: "Markdown (.md)" },
  { value: "text", label: "Text (.txt)" },
]

export function NodeConfigurationModal({
  isOpen,
  onClose,
  onConfigure,
  nodeType,
  initialPosition,
  initialValues,
}: NodeConfigurationModalProps) {
  const [label, setLabel] = useState("")
  const [description, setDescription] = useState("")
  const [fileType, setFileType] = useState("python")
  const [fileName, setFileName] = useState("")

  const applyInitialValues = useCallback(() => {
    setLabel(initialValues?.label ?? "")
    setDescription(initialValues?.description ?? "")
    setFileType(initialValues?.fileType ?? "python")
    setFileName(initialValues?.fileName ?? "")
  }, [initialValues, nodeType])

  useEffect(() => {
    if (isOpen) {
      applyInitialValues()
    }
  }, [isOpen, applyInitialValues])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const resolvedFileName = nodeType === "file"
      ? (fileName.trim() || initialValues?.fileName || "")
      : undefined

    if (nodeType === "file" && !resolvedFileName) {
      toast.error("Please provide a file name")
      return
    }

    const config: NodeConfiguration = {
      label: label.trim() || `${nodeType} node`,
      description: description.trim(),
      category: initialValues?.category || nodeType, // Use initialValues category if available, fallback to nodeType
      fileType: nodeType === "file" ? fileType : undefined,
      fileName: resolvedFileName,
    }

    onConfigure(config)
    onClose()
    applyInitialValues()
  }

  const handleClose = () => {
    onClose()
    applyInitialValues()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configure {nodeType} Node</DialogTitle>
          <DialogDescription>
            Set up your {nodeType} node properties. You can modify these later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`Enter ${nodeType} node label`}
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Describe what this ${nodeType} node does`}
              rows={3}
            />
          </div>
          
          {nodeType === "file" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fileType">File Type</Label>
                <Select value={fileType} onValueChange={setFileType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select file type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fileName">File Name</Label>
                <Input
                  id="fileName"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Enter file name (e.g., main.py)"
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Node
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
