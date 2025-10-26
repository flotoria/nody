"use client"

import { useState } from "react"
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
}

export interface NodeConfiguration {
  label: string
  description: string
  category: string
  fileType?: string
  fileName?: string
}

const NODE_TYPES = [
  { value: "file", label: "File Node" },
  { value: "folder", label: "Folder Node" },
  { value: "api", label: "API Node" },
  { value: "database", label: "Database Node" },
  { value: "service", label: "Service Node" },
  { value: "component", label: "Component Node" },
  { value: "custom", label: "Custom Node" },
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
}: NodeConfigurationModalProps) {
  const [label, setLabel] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState(nodeType)
  const [fileType, setFileType] = useState("python")
  const [fileName, setFileName] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const config: NodeConfiguration = {
      label: label.trim() || `${nodeType} node`,
      description: description.trim(),
      category: category.trim() || nodeType,
      fileType: nodeType === "file" ? fileType : undefined,
      fileName: nodeType === "file" ? fileName.trim() : undefined,
    }

    onConfigure(config)
    onClose()
    
    // Reset form
    setLabel("")
    setDescription("")
    setCategory(nodeType)
    setFileType("python")
    setFileName("")
  }

  const handleClose = () => {
    onClose()
    // Reset form
    setLabel("")
    setDescription("")
    setCategory(nodeType)
    setFileType("python")
    setFileName("")
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
          
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {NODE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
