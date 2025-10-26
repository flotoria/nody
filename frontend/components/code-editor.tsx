"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Save, X, Maximize2, Minimize2, AlertCircle } from "lucide-react"
import dynamic from "next/dynamic"

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

interface CodeEditorProps {
  content: string
  fileType: string
  fileName?: string
  onSave: (content: string) => void
  onClose: () => void
  isModified?: boolean
}

export function CodeEditor({ content, fileType, fileName, onSave, onClose, isModified = false }: CodeEditorProps) {
  const { theme } = useTheme()
  const [editedContent, setEditedContent] = useState(content)
  const [hasChanges, setHasChanges] = useState(isModified)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editorDimensions, setEditorDimensions] = useState({ width: '90vw', height: '90vh' })
  const editorRef = useRef<any>(null)

  // Set responsive dimensions after component mounts (client-side only)
  useEffect(() => {
    const isMobile = window.innerWidth < 768
    setEditorDimensions({
      width: isMobile ? '95vw' : '90vw',
      height: isMobile ? '85vh' : '90vh'
    })
  }, [])

  // Sync with external content changes and isModified prop
  useEffect(() => {
    setEditedContent(content)
    setHasChanges(isModified)
    setSaveError(null)
  }, [content, isModified])

  // Cleanup editor ref on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        if (typeof editorRef.current.dispose === 'function') {
          editorRef.current.dispose()
        }
        editorRef.current = null
      }
    }
  }, [])

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setEditedContent(value)
      setHasChanges(value !== content)
      setSaveError(null) // Clear any previous save errors
    }
  }, [content])

  const handleSave = useCallback(async () => {
    if (isSaving || !hasChanges) return
    
    setIsSaving(true)
    setSaveError(null)
    
    try {
      await onSave(editedContent)
      setHasChanges(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save file')
    } finally {
      setIsSaving(false)
    }
  }, [editedContent, hasChanges, isSaving, onSave])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [handleSave, onClose])

  const handleEditorDidMount = useCallback((editor: any) => {
    editorRef.current = editor
    
    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      lineHeight: 22,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "Courier New", monospace',
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true
      },
      renderLineHighlight: 'all',
      cursorBlinking: 'blink',
      cursorSmoothCaretAnimation: 'on' as const,
      smoothScrolling: true,
      contextmenu: true,
      mouseWheelZoom: true,
      padding: { top: 16, bottom: 16 },
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        useShadows: false,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        verticalScrollbarSize: 12,
        horizontalScrollbarSize: 12
      },
      // Ensure keyboard input works properly - disable auto-substitution
      acceptSuggestionOnEnter: 'on',
      acceptSuggestionOnCommitCharacter: false, // Disable auto-substitution on commit characters
      accessibilitySupport: 'auto',
      // Disable any potential input blocking
      readOnly: false,
      // Ensure all keys work
      multiCursorModifier: 'ctrlCmd',
      // Make sure spaces are handled correctly
      renderWhitespace: 'selection',
      // Disable quick suggestions and auto-substitutions
      quickSuggestions: false,
      // Disable text replacement features
      autoClosingQuotes: 'off',
      autoClosingBrackets: 'never',
      autoIndent: 'full'
    })
    
    // Prevent any auto-substitution behavior by listening to model changes
    const model = editor.getModel()
    if (model) {
      // Listen for content changes and prevent unwanted substitutions
      const disposable = model.onDidChangeContent((e: any) => {
        // Check if any change inserts a period after spaces
        // This would happen if OS or Monaco substitutes double-space with period
        e.changes.forEach((change: any) => {
          if (change.text.includes('.') && change.text.length === 1) {
            // If a single period was inserted, check the context
            const line = model.getLineContent(change.range.startLineNumber)
            const beforePeriod = line.substring(Math.max(0, change.range.startColumn - 2), change.range.startColumn)
            // If two spaces preceded the period, replace with two spaces
            if (beforePeriod === '  ') {
              // This is the double-space-to-period conversion - prevent it
              const newText = line.substring(0, change.range.startColumn - 1) + line.substring(change.range.startColumn)
              model.applyEdits([{
                range: {
                  startLineNumber: change.range.startLineNumber,
                  endLineNumber: change.range.endLineNumber,
                  startColumn: change.range.startColumn - 1,
                  endColumn: change.range.endColumn
                },
                text: ''
              }])
              // Insert two spaces instead
              model.applyEdits([{
                range: {
                  startLineNumber: change.range.startLineNumber,
                  endLineNumber: change.range.endLineNumber,
                  startColumn: change.range.startColumn - 1,
                  endColumn: change.range.startColumn - 1
                },
                text: '  '
              }])
            }
          }
        })
      })
      
      // Store disposable for cleanup
      editorRef.current = { editor, dispose: () => disposable.dispose() }
    } else {
      editorRef.current = { editor }
    }
    
    // Focus the editor immediately so keyboard input works
    requestAnimationFrame(() => {
      editor.focus()
    })
  }, [])

  const getMonacoLanguage = useCallback((fileType: string): string => {
    const languageMap: Record<string, string> = {
      'python': 'python',
      'javascript': 'javascript',
      'js': 'javascript',
      'typescript': 'typescript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'jsx': 'javascript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'markdown': 'markdown',
      'md': 'markdown',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'sql': 'sql',
      'shell': 'shell',
      'bash': 'shell',
      'sh': 'shell',
      'go': 'go',
      'rust': 'rust',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'cpp',
      'php': 'php',
      'ruby': 'ruby',
      'rb': 'ruby',
      'swift': 'swift',
      'kotlin': 'kotlin',
      'kt': 'kotlin',
      'dockerfile': 'dockerfile'
    }
    
    return languageMap[fileType.toLowerCase()] || 'plaintext'
  }, [])

  const monacoLanguage = useMemo(() => getMonacoLanguage(fileType), [fileType, getMonacoLanguage])
  
  const monacoTheme = useMemo(() => {
    return theme === 'dark' ? 'vs-dark' : 'vs-light'
  }, [theme])

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      // Store current dimensions before going fullscreen
      const isMobile = window.innerWidth < 768
      setEditorDimensions({
        width: isMobile ? '95vw' : '90vw',
        height: isMobile ? '85vh' : '90vh'
      })
    }
    setIsFullscreen(!isFullscreen)
  }, [isFullscreen])

  const handleClose = useCallback(() => {
    if (hasChanges) {
      const shouldClose = window.confirm('You have unsaved changes. Are you sure you want to close?')
      if (!shouldClose) return
    }
    onClose()
  }, [hasChanges, onClose])

  return (
    <div 
      className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background/95 backdrop-blur-xl border border-border/20 shadow-2xl p-6 flex flex-col transition-all duration-300 z-50 ${
        isFullscreen 
          ? 'w-[calc(100vw-2rem)] h-[calc(100vh-2rem)]' 
          : 'w-[95vw] h-[85vh] sm:w-[90vw] sm:h-[90vh] max-w-7xl'
      }`}
        style={{
          width: isFullscreen ? '100%' : editorDimensions.width,
          height: isFullscreen ? '100%' : editorDimensions.height,
        }}
        role="dialog"
        aria-label="Code Editor"
        aria-modal="true"
      >
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-foreground">
            {fileName ? fileName : "Code Editor"}
          </span>
          <span className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
            {fileType}
          </span>
          {hasChanges && (
            <span className="text-sm text-orange-500 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded">
              ● Modified
            </span>
          )}
          {saveError && (
            <span className="text-sm text-red-500 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Save Error
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleFullscreen}
            className="hover:bg-muted"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            aria-label="Save file"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClose}
            className="hover:bg-muted"
            aria-label="Close editor"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {saveError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="w-4 h-4" />
            <span>{saveError}</span>
          </div>
        </div>
      )}

      {/* Monaco Editor */}
      <div 
        className="flex-1 bg-[#1e1e1e] rounded-lg overflow-hidden min-h-0 relative border border-border/20"
        onKeyDown={(e) => {
          // Only handle Ctrl+S and Escape, let all other keys pass through to Monaco
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault()
            handleSave()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            handleClose()
          }
          // For all other keys (including space), let the event pass through to Monaco
        }}
      >
        <Editor
          height="100%"
          width="100%"
          language={monacoLanguage}
          value={editedContent}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          beforeMount={(monaco) => {
            // Ensure Monaco can handle all keyboard events
            monaco.editor.defineTheme('vs-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [],
              colors: {}
            })
          }}
          loading={
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <div>Loading editor...</div>
              </div>
            </div>
          }
        />
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              Lines: <span className="text-foreground font-medium">{editedContent.split('\n').length}</span>
            </span>
            <span>
              Characters: <span className="text-foreground font-medium">{editedContent.length}</span>
            </span>
            <span>
              Words: <span className="text-foreground font-medium">
                {editedContent.split(/\s+/).filter(w => w.length > 0).length}
              </span>
            </span>
            <span>
              Language: <span className="text-foreground font-medium">{monacoLanguage}</span>
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Press <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-xs">Ctrl+S</kbd> to save, 
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-xs ml-1">Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  )
}
