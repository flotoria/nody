import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { FileAPI, FileNode as ApiFileNode, FolderNode as ApiFolderNode, NodeMetadata } from "@/lib/api"

type EdgeRecord = {
  from: string
  to: string
  type?: string
  description?: string
}

interface UseCanvasDataReturn {
  fileRecords: ApiFileNode[]
  metadataRecords: Record<string, NodeMetadata>
  folderRecords: ApiFolderNode[]
  edgeRecords: EdgeRecord[]
  loading: boolean
  refreshMetadata: () => Promise<void>
}

export function useCanvasData(
  onDataChange?: (nodes: ApiFileNode[], metadata: Record<string, NodeMetadata>) => void,
  onMetadataUpdate?: (metadata: Record<string, NodeMetadata>) => void
): UseCanvasDataReturn {
  const [fileRecords, setFileRecords] = useState<ApiFileNode[]>([])
  const [metadataRecords, setMetadataRecords] = useState<Record<string, NodeMetadata>>({})
  const [folderRecords, setFolderRecords] = useState<ApiFolderNode[]>([])
  const [edgeRecords, setEdgeRecords] = useState<EdgeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const refreshInFlight = { current: false }

  const refreshMetadata = useCallback(async () => {
    if (refreshInFlight.current) return
    refreshInFlight.current = true
    try {
      const [files, metadata, folders] = await Promise.all([
        FileAPI.getFiles(),
        FileAPI.getMetadata(),
        FileAPI.getFolders(),
      ])
      setFileRecords(files)
      setMetadataRecords(metadata)
      setFolderRecords(folders)
    } finally {
      refreshInFlight.current = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let pollInterval: NodeJS.Timeout | null = null

    const loadData = async () => {
      try {
        const [files, metadataResponse, folders, edges] = await Promise.all([
          FileAPI.getFiles(),
          FileAPI.getMetadataRaw(),
          FileAPI.getFolders(),
          FileAPI.getEdges(),
        ])
        if (!mounted) return
        
        // Parse raw metadata
        const metadata = JSON.parse(metadataResponse.content)
        
        // Only update if data has actually changed
        setFileRecords(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(files)) {
            console.log('Canvas: Files updated from polling:', files)
            return files
          }
          return prev
        })
        
        setMetadataRecords(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(metadata)) {
            console.log('Canvas: Metadata updated from polling:', metadata)
            return metadata
          }
          return prev
        })
        
        setFolderRecords(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(folders)) {
            console.log('Canvas: Folders updated from polling:', folders)
            return folders
          }
          return prev
        })
        
        setEdgeRecords(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(edges)) {
            console.log('Canvas: Edges updated from polling:', edges)
            return edges
          }
          return prev
        })
      } catch (error) {
        console.error("Failed to load canvas data:", error)
        if (mounted) {
          toast.error("Failed to load workspace data")
        }
      }
    }

    const loadInitialData = async () => {
      setLoading(true)
      await loadData()
      if (mounted) {
        setLoading(false)
      }
    }

    // Load initial data
    loadInitialData()

    // Set up polling for real-time updates
    pollInterval = setInterval(loadData, 500)

    return () => {
      mounted = false
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [])

  useEffect(() => {
    if (onDataChange) {
      onDataChange(fileRecords, metadataRecords)
    }
  }, [fileRecords, metadataRecords, onDataChange])

  useEffect(() => {
    if (onMetadataUpdate) {
      onMetadataUpdate(metadataRecords)
    }
  }, [metadataRecords, onMetadataUpdate])

  return {
    fileRecords,
    metadataRecords,
    folderRecords,
    edgeRecords,
    loading,
    refreshMetadata,
  }
}

