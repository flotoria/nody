"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, FileText } from "lucide-react"

interface FileNamingModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateFile: (fileName: string, fileType: string) => void
}

const fileTypeMap: Record<string, string> = {
  'py': 'python',
  'js': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'jsx': 'javascript',
  'json': 'json',
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'scss': 'css',
  'sass': 'css',
  'md': 'markdown',
  'txt': 'text',
  'xml': 'xml',
  'yaml': 'yaml',
  'yml': 'yaml',
  'sql': 'sql',
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
  'fish': 'shell',
  'go': 'go',
  'rs': 'rust',
  'java': 'java',
  'cpp': 'cpp',
  'c': 'c',
  'h': 'c',
  'hpp': 'cpp',
  'php': 'php',
  'rb': 'ruby',
  'swift': 'swift',
  'kt': 'kotlin',
  'scala': 'scala',
  'r': 'r',
  'm': 'matlab',
  'pl': 'perl',
  'lua': 'lua',
  'vim': 'vim',
  'dockerfile': 'dockerfile',
  'docker': 'dockerfile',
}

export function FileNamingModal({ isOpen, onClose, onCreateFile }: FileNamingModalProps) {
  const [fileName, setFileName] = useState("")
  const [detectedType, setDetectedType] = useState("text")

  useEffect(() => {
    if (isOpen) {
      setFileName("")
      setDetectedType("text")
    }
  }, [isOpen])

  const handleFileNameChange = (value: string) => {
    setFileName(value)
    
    // Auto-detect file type from extension
    if (value.includes('.')) {
      const extension = value.split('.').pop()?.toLowerCase()
      if (extension && fileTypeMap[extension]) {
        setDetectedType(fileTypeMap[extension])
      } else {
        setDetectedType("text")
      }
    } else {
      setDetectedType("text")
    }
  }

  const handleCreate = () => {
    if (!fileName.trim()) return
    
    let finalFileName = fileName.trim()
    let finalType = detectedType
    
    // If no extension, add .txt
    if (!finalFileName.includes('.')) {
      finalFileName += '.txt'
      finalType = 'text'
    }
    
    onCreateFile(finalFileName, finalType)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="neu-raised-xl bg-card rounded-xl p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg neu-raised-sm bg-card flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Create New File</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 neu-raised-sm neu-hover neu-active"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="fileName" className="text-sm font-medium text-foreground">
              File Name
            </Label>
            <Input
              id="fileName"
              value={fileName}
              onChange={(e) => handleFileNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., main.py, index.js, README.md"
              className="mt-2 neu-inset bg-background"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Include extension for syntax highlighting (e.g., .py, .js, .ts)
            </p>
          </div>

          {/* File Type Preview */}
          <div className="neu-inset bg-background rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Detected Type:</span>
              <span className="text-sm font-medium text-foreground capitalize">
                {detectedType}
              </span>
            </div>
            {fileName && (
              <div className="mt-2 text-xs text-muted-foreground">
                Will create: <span className="font-mono text-foreground">{fileName || 'untitled.txt'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 neu-raised-sm neu-hover neu-active"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!fileName.trim()}
            className="flex-1 neu-primary text-primary-foreground neu-hover neu-active"
          >
            Create File
          </Button>
        </div>
      </div>
    </div>
  )
}
