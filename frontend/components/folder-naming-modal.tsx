"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Folder } from "lucide-react"

interface FolderNamingModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateFolder: (folderName: string) => void
  position?: { x: number; y: number }
}

export function FolderNamingModal({ isOpen, onClose, onCreateFolder, position }: FolderNamingModalProps) {
  const [folderName, setFolderName] = useState("")

  useEffect(() => {
    if (isOpen) {
      setFolderName("")
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (folderName.trim()) {
      onCreateFolder(folderName.trim())
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2 h-6 w-6 p-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Folder className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-semibold">Create Folder</h2>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Enter folder name..."
                autoFocus
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!folderName.trim()}>
                Create Folder
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
