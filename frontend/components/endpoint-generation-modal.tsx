"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileAPI } from "@/lib/api"
import { toast } from "sonner"
import { Loader2, X } from "lucide-react"

interface EndpointGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  method: "GET" | "POST"
}

export function EndpointGenerationModal({ isOpen, onClose, method }: EndpointGenerationModalProps) {
  const [endpointPath, setEndpointPath] = useState("")
  const [description, setDescription] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)

  if (!isOpen) return null

  const handleGenerate = async () => {
    if (!endpointPath || !description) {
      toast.error("Please fill in endpoint path and description")
      return
    }

    setIsGenerating(true)
    try {
      const response = method === "GET"
        ? await FileAPI.generateFastAPIGetEndpoint({
            endpoint_path: endpointPath,
            description
          })
        : await FileAPI.generateFastAPIPostEndpoint({
            endpoint_path: endpointPath,
            description
          })

      setGeneratedCode(response.code)
      toast.success(`${method} endpoint generated successfully!`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate endpoint")
      console.error("Failed to generate endpoint:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode)
      toast.success("Code copied to clipboard!")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Generate FastAPI {method} Endpoint</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Endpoint Path *</label>
            <input
              type="text"
              value={endpointPath}
              onChange={(e) => setEndpointPath(e.target.value)}
              placeholder="/users/{user_id}"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Retrieve user details by ID"
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background"
            />
          </div>

          {generatedCode && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Generated Code</label>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  Copy
                </Button>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs max-h-60">
                {generatedCode}
              </pre>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !endpointPath || !description}>
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}


