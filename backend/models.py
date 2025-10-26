"""
Pydantic models for API requests and responses.
"""
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Literal, Optional


class FileNode(BaseModel):
    id: str
    type: str = "file"
    label: str
    x: float
    y: float
    status: str = "idle"
    filePath: Optional[str] = None
    fileType: Optional[str] = None
    content: Optional[str] = None
    isExpanded: bool = False
    isModified: bool = False
    parentFolder: Optional[str] = None  # ID of containing folder
    category: Optional[str] = None


class FolderNode(BaseModel):
    id: str
    type: str = "folder"
    name: str
    x: float
    y: float
    width: float = 600
    height: float = 400
    isExpanded: bool = True
    containedFiles: List[str] = Field(default_factory=list)
    parentFolder: Optional[str] = None  # For nested folders


class FileContent(BaseModel):
    content: str


class FileCreate(BaseModel):
    filePath: str
    fileType: str
    content: str = ""
    description: str = ""
    category: Optional[str] = None


class NodeMetadata(BaseModel):
    id: str
    type: str
    description: str
    x: float
    y: float


class DescriptionUpdate(BaseModel):
    description: str


class OnboardingMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class OnboardingChatRequest(BaseModel):
    session_id: str
    messages: List[OnboardingMessage]


class OnboardingChatResponse(BaseModel):
    message: str
    status: Literal["collecting", "ready"]
    missing_information: List[str] = Field(default_factory=list)
    project_spec: Optional[Dict[str, Any]] = None
    spec_saved: bool = False


class ProjectSpecResponse(BaseModel):
    exists: bool
    project_spec: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class PrepareProjectResponse(BaseModel):
    message: str
    files_created: int
    metadata_nodes: int
    edges_created: int
    files: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


class AgentMessage(BaseModel):
    role: str
    content: str


class AgentChatRequest(BaseModel):
    messages: List[AgentMessage]
    agent_id: Optional[str] = None


class AgentChatResponse(BaseModel):
    agent_id: str
    messages: List[dict]


class TerminalCommand(BaseModel):
    command: str


class FolderCreate(BaseModel):
    name: str
    x: float = 100
    y: float = 100
    width: float = 600
    height: float = 400
    parentFolder: Optional[str] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    isExpanded: Optional[bool] = None
    containedFiles: Optional[List[str]] = None
