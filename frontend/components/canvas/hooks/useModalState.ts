import { useState } from "react"

export interface PendingNodeConfig {
  type: string
  position: { x: number; y: number }
  label?: string
  initialValues?: any
  template?: any
  categoryLabel?: string
}

export function useModalState() {
  const [showFileModal, setShowFileModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [showNodeConfigModal, setShowNodeConfigModal] = useState(false)
  const [pendingFilePosition, setPendingFilePosition] = useState<{ x: number; y: number } | null>(null)
  const [pendingFolderPosition, setPendingFolderPosition] = useState<{ x: number; y: number } | null>(null)
  const [pendingNodeConfig, setPendingNodeConfig] = useState<PendingNodeConfig | null>(null)

  const openCreateFileModal = (position?: { x: number; y: number }) => {
    setPendingFilePosition(position ?? { x: 160, y: 160 })
    setShowFileModal(true)
  }

  const openCreateFolderModal = (position?: { x: number; y: number }) => {
    setPendingFolderPosition(position ?? { x: 160, y: 160 })
    setShowFolderModal(true)
  }

  return {
    showFileModal,
    showFolderModal,
    showNodeConfigModal,
    pendingFilePosition,
    pendingFolderPosition,
    pendingNodeConfig,
    setShowFileModal,
    setShowFolderModal,
    setShowNodeConfigModal,
    setPendingFilePosition,
    setPendingFolderPosition,
    setPendingNodeConfig,
    openCreateFileModal,
    openCreateFolderModal,
  }
}

