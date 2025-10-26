// API service for connecting to FastAPI backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

export interface FileNode {
  id: string
  type: string
  label: string
  x: number
  y: number
  status: string
  filePath?: string
  fileType?: string
  content?: string
  description?: string
  isExpanded?: boolean
  isModified?: boolean
  parentFolder?: string
}

export interface FolderNode {
  id: string
  type: string
  name: string
  x: number
  y: number
  width: number
  height: number
  isExpanded: boolean
  containedFiles: string[]
  parentFolder?: string
}

export interface FileContent {
  content: string
}

export interface FileCreate {
  filePath: string
  fileType: string
  content?: string
  description?: string
}

export interface NodeMetadata {
  id: string
  type: string
  description: string
  x: number
  y: number
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
}

export interface ChatResponse {
  message: string
  generated_nodes?: Array<{
    type: string
    label: string
    description: string
    filePath?: string
    fileType?: string
  }>
}

export type OnboardingRole = "user" | "assistant" | "system"

export interface OnboardingChatMessage {
  role: OnboardingRole
  content: string
}

export interface ProjectFeature {
  name: string
  description: string
  acceptance_criteria: string[]
}

export interface TechnicalStack {
  frontend: string
  backend: string
  api: string
  database: string
  infrastructure: string
  third_party_services: string[]
}

export interface ProjectSpec {
  title: string
  summary: string
  goals: string[]
  target_users: string[]
  primary_features: ProjectFeature[]
  technical_stack: TechnicalStack
  integrations: string[]
  non_functional_requirements: string[]
  constraints: string[]
  success_metrics: string[]
  open_questions: string[]
}

export interface OnboardingChatResult {
  message: string
  status: "collecting" | "ready"
  missing_information: string[]
  project_spec?: ProjectSpec | null
  spec_saved: boolean
}

export interface ProjectSpecDocument {
  exists: boolean
  project_spec?: ProjectSpec | null
  metadata?: {
    session_id?: string
    generated_at?: string
    model?: string
  } | null
}

export interface PrepareProjectResult {
  message: string
  files_created: number
  metadata_nodes: number
  edges_created: number
  files: Array<{
    id: string
    label: string
    file_name: string
  }>
  edges: Array<{
    from: string
    to: string
    type?: string
    description?: string
  }>
}

export class FileAPI {
  static async getFiles(projectName?: string): Promise<FileNode[]> {
    if (projectName) {
      const response = await fetch(`${API_BASE_URL}/projects/${projectName}/files`)
      if (!response.ok) {
        throw new Error(`Failed to fetch project files: ${response.status}`)
      }
      return response.json()
    }
    
    // Fallback to global files for backward compatibility
    const response = await fetch(`${API_BASE_URL}/files`)
    if (!response.ok) {
      throw new Error('Failed to fetch files')
    }
    return response.json()
  }

  static async getFile(fileId: string): Promise<FileNode> {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}`)
    if (!response.ok) {
      throw new Error('Failed to fetch file')
    }
    return response.json()
  }

  static async updateFileContent(fileId: string, content: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/content`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    })
    if (!response.ok) {
      throw new Error('Failed to update file content')
    }
  }

  static async createFile(fileCreate: FileCreate, projectName?: string): Promise<{ success: boolean; data?: FileNode; error?: string }> {
    if (projectName) {
      // For project-specific file creation, we need to create the file in the project directory
      // and update the project's metadata
      try {
        // First, get the current project metadata
        const metadata = await this.getMetadata(projectName)
        
        // Generate a unique file ID
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // Create file metadata entry
        const fileMetadata = {
          id: fileId,
          type: "file",
          fileName: fileCreate.filePath,
          fileType: fileCreate.fileType,
          description: fileCreate.description || "",
          x: 100,
          y: 100,
          content: fileCreate.content || ""
        }
        
        // Update metadata with new file
        metadata[fileId] = fileMetadata
        
        // Save updated metadata
        const response = await fetch(`${API_BASE_URL}/projects/${projectName}/metadata`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          return { 
            success: false, 
            error: errorData.detail || 'Failed to create project file' 
          }
        }
        
        // Create the actual file in the project directory
        const fileResponse = await fetch(`${API_BASE_URL}/projects/${projectName}/files/${fileId}/content`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: fileCreate.content || "" }),
        })
        
        if (!fileResponse.ok) {
          const errorData = await fileResponse.json().catch(() => ({}))
          return { 
            success: false, 
            error: errorData.detail || 'Failed to create project file content' 
          }
        }
        
        return { 
          success: true, 
          data: {
            id: fileId,
            type: "file",
            label: fileCreate.filePath,
            x: 100,
            y: 100,
            status: "saved",
            filePath: fileCreate.filePath,
            fileType: fileCreate.fileType,
            content: fileCreate.content || "",
            description: fileCreate.description || ""
          }
        }
      } catch (error) {
        return { 
          success: false, 
          error: `Failed to create project file: ${error}` 
        }
      }
    }
    
    // Fallback to global file creation
    const response = await fetch(`${API_BASE_URL}/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fileCreate),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { 
        success: false, 
        error: errorData.detail || 'Failed to create file' 
      }
    }
    const data = await response.json()
    return { success: true, data }
  }

  static async deleteFile(fileId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete file')
    }
  }

  static async updateFilePosition(fileId: string, x: number, y: number, projectName?: string): Promise<void> {
    if (projectName) {
      // For project-specific position updates, we need to update the metadata
      try {
        const metadata = await this.getMetadata(projectName)
        if (metadata[fileId]) {
          metadata[fileId].x = x
          metadata[fileId].y = y
          
          const response = await fetch(`${API_BASE_URL}/projects/${projectName}/metadata`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(metadata),
          })
          
          if (!response.ok) {
            throw new Error('Failed to update project file position')
          }
          return
        }
      } catch (error) {
        throw new Error(`Failed to update project file position: ${error}`)
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/position?x=${x}&y=${y}`, {
      method: 'PUT',
    })
    if (!response.ok) {
      throw new Error('Failed to update file position')
    }
  }

  static async updateFileDescription(fileId: string, description: string, projectName?: string): Promise<void> {
    console.log('FileAPI: updateFileDescription called', { fileId, description, projectName })
    
    if (projectName) {
      const response = await fetch(`${API_BASE_URL}/projects/${projectName}/files/${fileId}/description`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      })
      console.log('FileAPI: project response status:', response.status, response.ok)
      if (!response.ok) {
        const errorText = await response.text()
        console.error('FileAPI: project response error:', errorText)
        throw new Error('Failed to update project file description')
      }
      console.log('FileAPI: project updateFileDescription successful')
      return
    }
    
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/description`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description }),
    })
    console.log('FileAPI: response status:', response.status, response.ok)
    if (!response.ok) {
      const errorText = await response.text()
      console.error('FileAPI: response error:', errorText)
      throw new Error('Failed to update file description')
    }
    console.log('FileAPI: updateFileDescription successful')
  }

  static async getMetadataRaw(projectName?: string): Promise<{ content: string }> {
    if (projectName) {
      const response = await fetch(`${API_BASE_URL}/projects/${projectName}/metadata/raw`)
      if (!response.ok) {
        throw new Error(`Failed to fetch project metadata: ${response.status}`)
      }
      return response.json()
    }
    
    const response = await fetch(`${API_BASE_URL}/metadata/raw`)
    if (!response.ok) {
      throw new Error('Failed to fetch metadata')
    }
    return response.json()
  }

  static async getMetadata(projectName?: string): Promise<Record<string, NodeMetadata>> {
    if (projectName) {
      const response = await fetch(`${API_BASE_URL}/projects/${projectName}/metadata`)
      if (!response.ok) {
        throw new Error('Failed to fetch project metadata')
      }
      return response.json()
    }
    
    const response = await fetch(`${API_BASE_URL}/metadata`)
    if (!response.ok) {
      throw new Error('Failed to fetch metadata')
    }
    return response.json()
  }

  static async getEdges(projectName?: string): Promise<Array<{ from: string; to: string; type?: string; description?: string }>> {
    if (projectName) {
      const response = await fetch(`${API_BASE_URL}/projects/${projectName}/edges`)
      if (!response.ok) {
        throw new Error('Failed to fetch project edges')
      }
      return response.json()
    }
    
    const response = await fetch(`${API_BASE_URL}/edges`)
    if (!response.ok) {
      throw new Error('Failed to fetch edges')
    }
    return response.json()
  }

  static async createEdge(edgeData: { from: string; to: string; type: string; description?: string }, projectName?: string): Promise<{ message: string; edge: any }> {
    if (projectName) {
      const response = await fetch(`${API_BASE_URL}/projects/${projectName}/edges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(edgeData),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to create project edge')
      }
      return response.json()
    }
    
    const response = await fetch(`${API_BASE_URL}/edges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(edgeData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(errorData.detail || 'Failed to create edge')
    }
    return response.json()
  }

  static async deleteEdge(from: string, to: string, type: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/edges?from_node=${from}&to_node=${to}&edge_type=${type}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(errorData.detail || 'Failed to delete edge')
    }
    return response.json()
  }

  static async getOutput(projectName?: string): Promise<{ messages: Array<{ timestamp: string; level: string; message: string }> }> {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
    
    if (projectName) {
      const response = await fetch(`${baseUrl}/projects/${projectName}/output`).catch(() => null)
      if (!response || !response.ok) {
        return { messages: [] }
      }
      return response.json()
    }
    
    const response = await fetch(`${baseUrl}/output`).catch(() => null)
    if (!response || !response.ok) {
      return { messages: [] }
    }
    return response.json()
  }

  // ==================== FOLDER OPERATIONS ====================

  static async getFolders(projectName?: string): Promise<FolderNode[]> {
    if (projectName) {
      const response = await fetch(`${API_BASE_URL}/projects/${projectName}/folders`)
      if (!response.ok) {
        throw new Error(`Failed to fetch project folders: ${response.status}`)
      }
      return response.json()
    }
    
    const response = await fetch(`${API_BASE_URL}/folders`)
    if (!response.ok) {
      throw new Error('Failed to fetch folders')
    }
    return response.json()
  }

  static async createFolder(name: string, x: number = 100, y: number = 100, width: number = 600, height: number = 400, projectName?: string): Promise<FolderNode> {
    console.log('FileAPI.createFolder called with projectName:', projectName)
    if (projectName) {
      const response = await fetch(`${API_BASE_URL}/projects/${projectName}/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, x, y, width, height }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to create project folder')
      }
      return response.json()
    }
    
    const response = await fetch(`${API_BASE_URL}/folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, x, y, width, height }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(errorData.detail || 'Failed to create folder')
    }
    return response.json()
  }

  static async updateFolder(folderId: string, updates: Partial<FolderNode>, projectName?: string): Promise<{ message: string }> {
    if (projectName) {
      const response = await fetch(`${API_BASE_URL}/projects/${projectName}/folders/${folderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to update project folder')
      }
      return response.json()
    }
    
    const response = await fetch(`${API_BASE_URL}/folders/${folderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(errorData.detail || 'Failed to update folder')
    }
    return response.json()
  }

  static async deleteFolder(folderId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/folders/${folderId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(errorData.detail || 'Failed to delete folder')
    }
    return response.json()
  }

  static async moveFileToFolder(fileId: string, folderId: string | null): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/folder?folder_id=${folderId || ''}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(errorData.detail || 'Failed to move file')
    }
    return response.json()
  }

  static async clearOutput(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/output/clear`, {
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error('Failed to clear output')
    }
  }

  static async clearCanvas(): Promise<void> {
    try {
      // Use the new efficient canvas clear endpoint
      const response = await fetch(`${API_BASE_URL}/canvas/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Failed to clear canvas')
      }
    } catch (error) {
      console.error('Failed to clear canvas:', error)
      throw new Error('Failed to clear canvas')
    }
  }
  static async generateFileCode(fileId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/generate`, {
      method: 'POST',
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { 
        success: false, 
        error: errorData.detail || 'Failed to generate code' 
      }
    }
    const data = await response.json()
    return { success: true, data }
  }

  static async runFile(fileId: string, onOutput?: (output: string) => void, onComplete?: (success: boolean, returnCode?: number) => void): Promise<{ success: boolean; eventSource?: EventSource; error?: string }> {
    try {
      // Use Server-Sent Events for streaming
      const eventSource = new EventSource(`${API_BASE_URL}/files/${fileId}/run`)
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.output && onOutput) {
            onOutput(data.output)
          }
          
          if (data.done !== undefined) {
            if (onComplete) {
              onComplete(data.success || false, data.return_code)
            }
            eventSource.close()
          }
          
          if (data.error) {
            console.error('Run error:', data.error)
            if (onComplete) {
              onComplete(false)
            }
            eventSource.close()
          }
        } catch (e) {
          console.error('Error parsing SSE data:', e)
        }
      }
      
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error)
        if (onComplete) {
          onComplete(false)
        }
        eventSource.close()
      }
      
      return { success: true, eventSource }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start file execution'
      }
    }
  }

  static async stopFile(fileId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/files/${fileId}/stop`, {
        method: 'POST',
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return { 
          success: false, 
          error: errorData.detail || 'Failed to stop file' 
        }
      }
      const data = await response.json()
      return { success: data.success || true, message: data.message }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to stop file'
      }
    }
  }

  static async getFileStatus(fileId: string): Promise<{ status: string; running: boolean; pid?: number; return_code?: number }> {
    try {
      const response = await fetch(`${API_BASE_URL}/files/${fileId}/status`)
      if (!response.ok) {
        return { status: 'not_running', running: false }
      }
      return response.json()
    } catch (error) {
      return { status: 'not_running', running: false }
    }
  }

  static async runProject(projectName?: string): Promise<{ success: boolean; progress?: string[] }> {
    if (projectName) {
      const response = await fetch(`${API_BASE_URL}/projects/${projectName}/run`, {
        method: 'POST',
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return { 
          success: false, 
          progress: errorData.progress || [] 
        }
      }
      const data = await response.json()
      return { success: true, progress: data.progress || [] }
    }
    
    const response = await fetch(`${API_BASE_URL}/run`, {
      method: 'POST',
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { 
        success: false, 
        progress: errorData.progress || [] 
      }
    }
    const data = await response.json()
    return { success: true, progress: data.progress || [] }
  }

  static async startApplication(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/run-app`, {
      method: 'POST',
    })
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Failed to start application')
      throw new Error(errorText)
    }
    return response.json()
  }

  static async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE_URL}/chat/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    })
    if (!response.ok) {
      throw new Error('Failed to send chat message')
    }
    return response.json()
  }
}

export class OnboardingAPI {
  static async chat(sessionId: string, messages: OnboardingChatMessage[]): Promise<OnboardingChatResult> {
    const response = await fetch(`${API_BASE_URL}/onboarding/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        messages,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Failed to process onboarding chat: ${errorText}`)
    }

    return response.json()
  }

  static async getProjectSpec(): Promise<ProjectSpecDocument> {
    const response = await fetch(`${API_BASE_URL}/onboarding/spec`)
    if (!response.ok) {
      throw new Error('Failed to load project specification')
    }
    return response.json()
  }

  static async prepareProject(): Promise<PrepareProjectResult> {
    const response = await fetch(`${API_BASE_URL}/onboarding/prepare-project`, {
      method: 'POST',
    })
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Failed to prepare project workspace: ${errorText}`)
    }
    return response.json()
  }
}
