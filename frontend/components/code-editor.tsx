"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Save, X } from "lucide-react"

interface CodeEditorProps {
  content: string
  fileType: string
  onSave: (content: string) => void
  onClose: () => void
  isModified?: boolean
}

export function CodeEditor({ content, fileType, onSave, onClose, isModified }: CodeEditorProps) {
  const [editedContent, setEditedContent] = useState(content)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setEditedContent(content)
    setHasChanges(false)
  }, [content])

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value)
    setHasChanges(e.target.value !== content)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }

  const handleSave = () => {
    onSave(editedContent)
    setHasChanges(false)
  }

  const getLanguageClass = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'python':
        return 'language-python'
      case 'javascript':
      case 'js':
        return 'language-javascript'
      case 'typescript':
      case 'ts':
        return 'language-typescript'
      case 'json':
        return 'language-json'
      case 'html':
        return 'language-html'
      case 'css':
        return 'language-css'
      default:
        return 'language-text'
    }
  }

  return (
    <div className="neu-raised-xl bg-card rounded-xl p-6 w-full max-w-6xl max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-foreground">Code Editor</span>
          <span className="text-sm text-muted-foreground px-2 py-1 neu-inset-sm bg-background rounded">
            {fileType}
          </span>
          {hasChanges && <span className="text-sm text-orange-400 px-2 py-1 neu-inset-sm bg-orange-400/10 rounded">● Modified</span>}
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges}
            className="neu-primary text-primary-foreground neu-hover neu-active"
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="neu-raised-sm neu-hover neu-active"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Code Editor */}
      <div className="flex-1 neu-inset bg-background rounded-lg overflow-hidden min-h-0">
        <textarea
          value={editedContent}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          className={`w-full h-full p-6 bg-transparent text-sm font-mono text-foreground resize-none focus:outline-none ${getLanguageClass(fileType)}`}
          style={{
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            lineHeight: '1.6',
            tabSize: 2,
            minHeight: '400px',
          }}
          spellCheck={false}
          placeholder="Start typing your code here..."
        />
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Lines: <span className="text-foreground font-medium">{editedContent.split('\n').length}</span></span>
            <span>Characters: <span className="text-foreground font-medium">{editedContent.length}</span></span>
            <span>Words: <span className="text-foreground font-medium">{editedContent.split(/\s+/).filter(w => w.length > 0).length}</span></span>
          </div>
          <div className="text-xs text-muted-foreground">
            Press <kbd className="px-1 py-0.5 neu-inset-sm bg-background rounded text-xs">Ctrl+S</kbd> to save
          </div>
        </div>
      </div>
    </div>
  )
}
