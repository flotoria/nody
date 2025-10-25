// API service for connecting to FastAPI backend
const API_BASE_URL = 'http://localhost:8000'

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
}

export interface NodeMetadata {
  id: string
  type: string
  description: string
  x: number
  y: number
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

  static async createFile(fileCreate: FileCreate): Promise<FileNode> {
    const response = await fetch(`${API_BASE_URL}/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fileCreate),
    })
    if (!response.ok) {
      throw new Error('Failed to create file')
    }
    return response.json()
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

  static async getMetadata(): Promise<Record<string, NodeMetadata>> {
    const response = await fetch(`${API_BASE_URL}/metadata`)
    if (!response.ok) {
      throw new Error('Failed to fetch metadata')
    }
    return response.json()
  }
}
