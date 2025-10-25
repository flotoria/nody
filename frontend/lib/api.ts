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
  isExpanded?: boolean
  isModified?: boolean
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
  static async getFiles(): Promise<FileNode[]> {
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

  static async createFile(fileCreate: FileCreate): Promise<{ success: boolean; data?: FileNode; error?: string }> {
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

  static async updateFilePosition(fileId: string, x: number, y: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}/position?x=${x}&y=${y}`, {
      method: 'PUT',
    })
    if (!response.ok) {
      throw new Error('Failed to update file position')
    }
  }

  static async updateFileDescription(fileId: string, description: string): Promise<void> {
    console.log('FileAPI: updateFileDescription called', { fileId, description })
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

  static async getMetadata(): Promise<Record<string, NodeMetadata>> {
    const response = await fetch(`${API_BASE_URL}/metadata`)
    if (!response.ok) {
      throw new Error('Failed to fetch metadata')
    }
    return response.json()
  }

  static async getOutput(): Promise<{ messages: Array<{ timestamp: string; level: string; message: string }> }> {
    const response = await fetch(`${API_BASE_URL}/output`)
    if (!response.ok) {
      throw new Error('Failed to fetch output')
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

  static async runProject(): Promise<{ success: boolean; progress?: string[] }> {
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

  static async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE_URL}/chat`, {
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
