from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Literal, Optional
import os
import json
from datetime import datetime
from dotenv import load_dotenv
from letta_client import Letta
from agent import create_file_system_agent
import httpx

# Load environment variables
load_dotenv()

import sys

# Add the 'class' directory to Python path to import from it
class_dir = os.path.join(os.path.dirname(__file__), 'class')
if class_dir not in sys.path:
    sys.path.insert(0, class_dir)

try:
    from workspace_manager import WorkspaceManager
    from terminal_executor import TerminalExecutor
except ImportError as e:
    print(f"Error importing workspace/terminal modules: {e}")
    WorkspaceManager = None
    TerminalExecutor = None

app = FastAPI(title="Nody VDE Backend", version="0.1.0")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
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

class FileContent(BaseModel):
    content: str

class FileCreate(BaseModel):
    filePath: str
    fileType: str
    content: str = ""
    description: str = ""

class NodeMetadata(BaseModel):
    id: str
    type: str
    description: str
    x: float
    y: float

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

# In-memory storage for demo (replace with database later)
files_db = {}
onboarding_sessions: Dict[str, Dict[str, Any]] = {}

# Letta agent setup
_client = None
_agent = None

# Initialize Letta agent on startup
@app.on_event("startup")
async def startup_event():
    """Initialize the Letta agent on startup."""
    global _client, _agent
    try:
        _client, _agent = create_file_system_agent()
        print(f"Letta agent initialized with ID: {_agent.id}")
    except Exception as e:
        print(f"Failed to initialize Letta agent: {e}")
        print("Make sure you have:")
        print("1. Set LETTA_API_KEY environment variable for Letta Cloud, OR")
        print("2. Started a self-hosted Letta server and set LETTA_BASE_URL")

# Ensure canvas directories exist
CANVAS_ROOT = os.path.join(os.path.dirname(__file__), "..", "canvas")
os.makedirs(CANVAS_ROOT, exist_ok=True)
CANVAS_DIR = os.path.join(CANVAS_ROOT, "files")
os.makedirs(CANVAS_DIR, exist_ok=True)
PROJECT_SPEC_PATH = os.path.join(CANVAS_ROOT, "project-spec.json")
EDGES_FILE = os.path.join(CANVAS_ROOT, "edges.json")

# Groq configuration
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
ONBOARDING_SYSTEM_PROMPT = """
You are Nody's onboarding architect. Your job is to gather the minimum viable specification needed to auto-generate a software project.
Always respond with a JSON object that contains exactly these keys:
- assistant_message (string): what you say to the user. Ask concise follow-up questions when you still need information.
- status (string): either "collecting" or "ready".
- missing_information (array of strings): high-level bullet points describing the remaining information you need. Use an empty array when nothing is missing.
- project_spec (object or null): null while you are still collecting information. When status is "ready", include a complete project specification with the fields shown below.

When status is "ready", project_spec must include:
{
  "title": string,
  "summary": string,
  "goals": [string],
  "target_users": [string],
  "primary_features": [
    {
      "name": string,
      "description": string,
      "acceptance_criteria": [string]
    }
  ],
  "technical_stack": {
    "frontend": string,
    "backend": string,
    "api": string,
    "database": string,
    "infrastructure": string,
    "third_party_services": [string]
  },
  "integrations": [string],
  "non_functional_requirements": [string],
  "constraints": [string],
  "success_metrics": [string],
  "open_questions": [string]
}

Guidelines:
- Never wrap the JSON output in markdown code fences or add commentary outside the JSON.
- While status is "collecting", assistant_message must include at least one targeted follow-up question that helps resolve the highest-priority missing information.
- Once you have enough detail, set status to "ready", ensure missing_information is an empty array, provide the complete project_spec, and summarise the plan in assistant_message.
""".strip()
ONBOARDING_METADATA_PROMPT = """
You are Nody's project planner. Convert a confirmed project specification into a concrete implementation plan for the code generator.

Return ONLY a JSON object with the following keys:
- files: array of file nodes that should exist in the project. Each object MUST include:
  - id: unique identifier (snake_case, no spaces)
  - file_name: relative path including extension (e.g. "backend/api/auth.py")
  - label: short display label (typically the file's basename)
  - description: detailed guidance for code generation describing responsibilities, APIs, data models, and acceptance criteria.
- edges: array describing high-level relationships between files. Each edge object should include:
  - from: source file id
  - to: target file id
  - type: short string such as "depends_on", "calls", or "data_flow"
  - description: one sentence explaining the relationship

Guidelines:
- Produce between 3 and 12 files covering the major features, API surfaces, data models, configuration, and front-end pieces mentioned in the specification.
- Choose reasonable directories based on the described technical stack (e.g. Next.js => "frontend/app/...tsx", FastAPI => "backend/api/...py").
- Ensure the descriptions contain enough detail for an LLM to implement each file end-to-end without further context.
- If the specification is sparse, still create a viable scaffold using the provided goals.
- Output must be raw JSON with keys exactly as described. Do not use code fences or add narrative text.
""".strip()

def load_existing_files():
    """Load existing files from filesystem and metadata"""
    global files_db
    metadata = load_metadata()
    
    for node_id, node_meta in metadata.items():
        if node_meta.get("type") == "file":
            # Check if file exists on filesystem
            file_path = os.path.join(CANVAS_DIR, f"{node_id}.txt")  # Default to .txt for now
            
            # Try to find the actual file by looking for files with the node_id
            actual_file_path = None
            if os.path.exists(file_path):
                actual_file_path = file_path
            else:
                # Look for any file that might match this node
                files_in_dir = os.listdir(CANVAS_DIR)
                if files_in_dir:
                    # If there's only one file, use it (common case)
                    if len(files_in_dir) == 1:
                        actual_file_path = os.path.join(CANVAS_DIR, files_in_dir[0])
                    else:
                        # Look for files that start with node_id or contain node_id
                        for filename in files_in_dir:
                            if filename.startswith(node_id) or node_id in filename:
                                actual_file_path = os.path.join(CANVAS_DIR, filename)
                                break
                        # If no match found, use the first file (fallback)
                        if not actual_file_path:
                            actual_file_path = os.path.join(CANVAS_DIR, files_in_dir[0])
            
            if actual_file_path and os.path.exists(actual_file_path):
                # Read file content
                try:
                    with open(actual_file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                except:
                    content = ""
                
                # Determine file type from extension
                file_extension = os.path.splitext(actual_file_path)[1]
                file_type_map = {
                    '.py': 'python',
                    '.js': 'javascript', 
                    '.ts': 'typescript',
                    '.json': 'json',
                    '.html': 'html',
                    '.css': 'css',
                    '.md': 'markdown',
                    '.txt': 'text'
                }
                file_type = file_type_map.get(file_extension, 'text')
                
                # Create FileNode object
                file_node = FileNode(
                    id=node_id,
                    label=os.path.basename(actual_file_path),
                    type="file",
                    filePath=os.path.basename(actual_file_path),
                    fileType=file_type,
                    content=content,
                    x=node_meta.get("x", 0),
                    y=node_meta.get("y", 0),
                    status="idle",
                    isExpanded=False,
                    isModified=False
                )
                
                files_db[node_id] = file_node
                print(f"Loaded file: {node_id} -> {actual_file_path}")

# Metadata file path
METADATA_FILE = os.path.join(CANVAS_ROOT, "metadata.json")

# Output file for real-time progress
OUTPUT_FILE = os.path.join(CANVAS_ROOT, "output.json")

# Helper functions for metadata
def load_metadata() -> dict:
    """Load metadata from JSON file"""
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}

def save_metadata(metadata: dict):
    """Save metadata to JSON file"""
    try:
        with open(METADATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
    except IOError as e:
        print(f"Error saving metadata: {e}")

def update_node_metadata(node_id: str, node_type: str, description: str, x: float, y: float):
    """Update metadata for a specific node"""
    metadata = load_metadata()
    # Preserve existing fields like fileName
    existing_data = metadata.get(node_id, {})
    metadata[node_id] = {
        "id": node_id,
        "type": node_type,
        "description": description,
        "x": x,
        "y": y,
        **{k: v for k, v in existing_data.items() if k not in ["id", "type", "description", "x", "y"]}
    }
    save_metadata(metadata)

def remove_node_metadata(node_id: str):
    """Remove metadata for a specific node"""
    metadata = load_metadata()
    if node_id in metadata:
        del metadata[node_id]
        save_metadata(metadata)

# Helper functions for output file
def write_output(message: str, level: str = "INFO"):
    """Write a message to the output file for real-time progress"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    output_entry = {
        "timestamp": timestamp,
        "level": level,
        "message": message
    }
    
    # Load existing output or create new
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                output_data = json.load(f)
        except (json.JSONDecodeError, IOError):
            output_data = {"messages": []}
    else:
        output_data = {"messages": []}
    
    # Add new message
    output_data["messages"].append(output_entry)
    
    # Keep only last 100 messages to prevent file from growing too large
    if len(output_data["messages"]) > 100:
        output_data["messages"] = output_data["messages"][-100:]
    
    # Write back to file
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
    except IOError as e:
        print(f"Error writing output: {e}")

def clear_output():
    """Clear the output file"""
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump({"messages": []}, f, indent=2, ensure_ascii=False)
    except IOError as e:
        print(f"Error clearing output: {e}")


def _load_project_spec_document() -> Optional[Dict[str, Any]]:
    """Load the persisted project specification document if it exists."""
    if not os.path.exists(PROJECT_SPEC_PATH):
        return None
    try:
        with open(PROJECT_SPEC_PATH, "r", encoding="utf-8") as spec_file:
            return json.load(spec_file)
    except (json.JSONDecodeError, OSError) as exc:
        print(f"Error reading project spec: {exc}")
        return None


def _persist_project_spec(session_id: str, project_spec: Dict[str, Any]) -> Dict[str, Any]:
    """Persist the project specification to disk with basic metadata."""
    document = {
        "session_id": session_id,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "model": GROQ_MODEL,
        "project_spec": project_spec,
    }
    try:
        with open(PROJECT_SPEC_PATH, "w", encoding="utf-8") as spec_file:
            json.dump(document, spec_file, indent=2, ensure_ascii=False)
    except OSError as exc:
        print(f"Error writing project spec: {exc}")
        raise HTTPException(status_code=500, detail="Failed to persist project specification") from exc
    return document


def _extract_structured_payload(raw_content: str) -> Dict[str, Any]:
    """Parse the Groq assistant response into a structured JSON payload."""
    content = raw_content.strip()
    if content.startswith("```"):
        content = content.strip("`")
        if "\n" in content:
            _, remainder = content.split("\n", 1)
            content = remainder
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Groq response could not be parsed as JSON") from exc


async def _invoke_groq(messages: List[Dict[str, str]]) -> Dict[str, Any]:
    """Send the conversation to Groq's chat completions API and return the response JSON."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="Groq API key not configured")

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 1600,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(GROQ_API_URL, headers=headers, json=payload)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Groq API request failed: {exc}") from exc

    if response.status_code >= 400:
        try:
            error_payload = response.json()
            error_detail = error_payload.get("error", error_payload)
        except json.JSONDecodeError:
            error_detail = response.text
        raise HTTPException(status_code=502, detail=f"Groq API error: {error_detail}")

    try:
        return response.json()
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Groq API returned invalid JSON") from exc


def _slugify(value: str) -> str:
    """Convert a string into a filesystem and metadata friendly identifier."""
    cleaned = ''.join(char if char.isalnum() else '_' for char in value.lower())
    cleaned = '_'.join(part for part in cleaned.split('_') if part)
    return cleaned or "node"


def _infer_default_extension(project_spec: Dict[str, Any]) -> str:
    """Guess a sensible default file extension based on the declared tech stack."""
    stack = project_spec.get("technical_stack", {})
    combined = " ".join([
        stack.get("frontend", ""),
        stack.get("backend", ""),
        stack.get("api", ""),
        stack.get("infrastructure", ""),
    ]).lower()

    if any(keyword in combined for keyword in ["python", "fastapi", "django", "flask"]):
        return ".py"
    if any(keyword in combined for keyword in ["typescript", "next", "react", "angular"]):
        return ".tsx"
    if "javascript" in combined or "node" in combined or "express" in combined:
        return ".js"
    if "go" in combined:
        return ".go"
    if "java" in combined or "spring" in combined:
        return ".java"
    if "c#" in combined or "dotnet" in combined:
        return ".cs"
    if "swift" in combined:
        return ".swift"
    if "kotlin" in combined:
        return ".kt"
    return ".txt"


def _infer_file_type_from_name(file_name: str) -> str:
    """Map a file extension to a FileNode friendly type label."""
    ext = os.path.splitext(file_name)[1].lower()
    mapping = {
        ".py": "python",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".js": "javascript",
        ".jsx": "javascript",
        ".json": "json",
        ".md": "markdown",
        ".go": "go",
        ".java": "java",
        ".cs": "csharp",
        ".kt": "kotlin",
        ".swift": "swift",
        ".html": "html",
        ".css": "css",
        ".sql": "sql",
        ".yml": "yaml",
        ".yaml": "yaml",
        ".txt": "text",
    }
    return mapping.get(ext, "text")


def _position_for_index(index: int) -> tuple[float, float]:
    """Create a deterministic position for nodes in a loose grid layout."""
    columns = 4
    x_spacing = 260
    y_spacing = 200
    margin_x = 160
    margin_y = 140
    row = index // columns
    column = index % columns
    return margin_x + column * x_spacing, margin_y + row * y_spacing


def save_edges(edges: List[Dict[str, Any]]):
    """Persist edge relationships to disk."""
    try:
        with open(EDGES_FILE, "w", encoding="utf-8") as f:
            json.dump({"edges": edges}, f, indent=2, ensure_ascii=False)
    except OSError as exc:
        print(f"Error saving edges: {exc}")


def _fallback_metadata_plan(project_spec: Dict[str, Any]) -> Dict[str, Any]:
    """Create a deterministic scaffold when Groq is unavailable or returns nothing."""
    features = project_spec.get("primary_features") or []
    goals = project_spec.get("goals") or []
    extension = _infer_default_extension(project_spec)
    files_plan = []
    edges_plan = []

    if not features:
        files_plan.append({
            "id": "project_entrypoint",
            "label": f"app{extension.lstrip('.')}",
            "file_name": f"app/app{extension}",
            "description": (
                f"Project entrypoint implementing the core workflow. Summary: {project_spec.get('summary', 'No summary provided')}."
                " Include setup for the selected tech stack and placeholders for the major goals."
            ),
        })
    else:
        for index, feature in enumerate(features, start=1):
            name = feature.get("name") or f"Feature {index}"
            slug = _slugify(name)
            directory = "app"
            if extension in {".py", ".go", ".java", ".cs", ".kt"}:
                directory = "backend"
            elif extension in {".tsx", ".ts", ".js", ".jsx"}:
                directory = "frontend"
            file_name = f"{directory}/{slug}{extension}"
            description_lines = [
                f"Implement the feature '{name}'.",
                feature.get("description", ""),
            ]
            criteria = feature.get("acceptance_criteria") or []
            if criteria:
                description_lines.append("Acceptance criteria:")
                description_lines.extend(f"- {item}" for item in criteria)
            if goals:
                description_lines.append("Overall project goals to respect:")
                description_lines.extend(f"- {goal}" for goal in goals)

            files_plan.append({
                "id": slug,
                "label": os.path.basename(file_name),
                "file_name": file_name,
                "description": "\n".join(line for line in description_lines if line),
            })

            if index > 1:
                edges_plan.append({
                    "from": files_plan[index - 2]["id"],
                    "to": slug,
                    "type": "depends_on",
                    "description": f"{files_plan[index - 2]['label']} provides data consumed by {os.path.basename(file_name)}.",
                })

    return {"files": files_plan, "edges": edges_plan}


async def _generate_metadata_from_spec(project_spec: Dict[str, Any]) -> Dict[str, Any]:
    """Use Groq to convert the project specification into file and edge metadata."""
    try:
        response = await _invoke_groq([
            {"role": "system", "content": ONBOARDING_METADATA_PROMPT},
            {"role": "user", "content": json.dumps(project_spec, indent=2, ensure_ascii=False)},
        ])
        assistant_content = response["choices"][0]["message"]["content"]
        payload = _extract_structured_payload(assistant_content)
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Groq metadata planning failed: {exc}")
        return _fallback_metadata_plan(project_spec)

    files_plan = payload.get("files")
    if not isinstance(files_plan, list) or not files_plan:
        return _fallback_metadata_plan(project_spec)

    edges_plan = payload.get("edges")
    if not isinstance(edges_plan, list):
        edges_plan = []

    return {"files": files_plan, "edges": edges_plan}

@app.get("/")
async def root():
    return {"message": "Nody VDE Backend API"}

@app.get("/files", response_model=List[FileNode])
async def get_files():
    """Get all file nodes"""
    return list(files_db.values())

@app.get("/files/{file_id}", response_model=FileNode)
async def get_file(file_id: str):
    """Get a specific file node"""
    if file_id not in files_db:
        raise HTTPException(status_code=404, detail="File not found")
    return files_db[file_id]

@app.put("/files/{file_id}/content")
async def update_file_content(file_id: str, file_content: FileContent):
    """Update file content"""
    if file_id not in files_db:
        raise HTTPException(status_code=404, detail="File not found")
    
    files_db[file_id].content = file_content.content
    files_db[file_id].isModified = False
    
    # Write to actual file
    file_path = os.path.join(CANVAS_DIR, files_db[file_id].filePath)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(file_content.content)
    
    return {"message": "File content updated successfully"}

@app.post("/files", response_model=FileNode)
async def create_file(file_create: FileCreate):
    """Create a new file node"""
    # Check for duplicate file name
    for existing_file in files_db.values():
        if existing_file.filePath == file_create.filePath:
            raise HTTPException(
                status_code=400, 
                detail=f"File with name '{file_create.filePath}' already exists"
            )
    
    file_id = str(len(files_db) + 1)
    
    new_file = FileNode(
        id=file_id,
        label=os.path.basename(file_create.filePath),
        x=100,
        y=100,
        filePath=file_create.filePath,
        fileType=file_create.fileType,
        content=file_create.content
    )
    
    files_db[file_id] = new_file
    
    # Create actual file on filesystem
    file_path = os.path.join(CANVAS_DIR, file_create.filePath)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(file_create.content)
    
    # Update metadata with file name
    final_description = file_create.description if file_create.description else f"File: {file_create.filePath} ({file_create.fileType})"
    update_node_metadata(file_id, "file", final_description, new_file.x, new_file.y)
    
    # Also store the file name in metadata for easy access
    metadata = load_metadata()
    if file_id in metadata:
        metadata[file_id]["fileName"] = file_create.filePath
        save_metadata(metadata)
    
    return new_file

@app.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """Delete a file node"""
    if file_id not in files_db:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Remove from filesystem
    file_path = os.path.join(CANVAS_DIR, files_db[file_id].filePath)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Remove from metadata
    remove_node_metadata(file_id)
    
    del files_db[file_id]
    return {"message": "File deleted successfully"}

@app.put("/files/{file_id}/position")
async def update_file_position(file_id: str, x: float, y: float):
    """Update file node position"""
    if file_id not in files_db:
        raise HTTPException(status_code=404, detail="File not found")
    
    files_db[file_id].x = x
    files_db[file_id].y = y
    
    # Update metadata position
    node = files_db[file_id]
    # Preserve existing description instead of overriding it
    existing_metadata = load_metadata()
    existing_description = existing_metadata.get(file_id, {}).get("description", f"File: {node.filePath} ({node.fileType})")
    update_node_metadata(file_id, "file", existing_description, x, y)
    
    return {"message": "File position updated successfully"}

class DescriptionUpdate(BaseModel):
    description: str

@app.put("/files/{file_id}/description")
async def update_file_description(file_id: str, description_update: DescriptionUpdate):
    """Update file node description"""
    if file_id not in files_db:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Update metadata
    node = files_db[file_id]
    update_node_metadata(file_id, "file", description_update.description, node.x, node.y)
    
    return {"message": "File description updated successfully"}

@app.get("/metadata")
async def get_metadata():
    """Get all node metadata"""
    return load_metadata()

@app.get("/output")
async def get_output():
    """Get real-time output messages"""
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {"messages": []}
    return {"messages": []}

@app.post("/output/clear")
async def clear_output_endpoint():
    """Clear the output file"""
    clear_output()
    return {"message": "Output cleared"}

@app.post("/onboarding/chat", response_model=OnboardingChatResponse)
async def onboarding_chat(request: OnboardingChatRequest):
    """Handle onboarding conversation using Groq to gather project specifications."""
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    # Build conversation payload for Groq
    groq_messages = [{"role": "system", "content": ONBOARDING_SYSTEM_PROMPT}]
    for message in request.messages:
        if message.role == "system":
            continue  # System prompt managed internally
        groq_messages.append({"role": message.role, "content": message.content})

    groq_response = await _invoke_groq(groq_messages)

    try:
        assistant_content = groq_response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="Groq API returned an unexpected payload") from exc

    payload = _extract_structured_payload(assistant_content)
    required_keys = {"assistant_message", "status", "missing_information", "project_spec"}
    if not required_keys.issubset(payload):
        raise HTTPException(status_code=502, detail="Groq response missing required fields")

    status = payload["status"]
    if status not in ("collecting", "ready"):
        raise HTTPException(status_code=502, detail="Groq response contained invalid status")

    assistant_message = str(payload["assistant_message"])
    missing_information_raw = payload.get("missing_information") or []
    if isinstance(missing_information_raw, list):
        missing_information = [str(item) for item in missing_information_raw]
    else:
        missing_information = [str(missing_information_raw)]

    project_spec = payload.get("project_spec")
    spec_saved = False

    if status == "ready":
        if not isinstance(project_spec, dict):
            raise HTTPException(status_code=502, detail="Groq response missing project_spec details")
        _persist_project_spec(request.session_id, project_spec)
        spec_saved = True
    else:
        project_spec = None

    onboarding_sessions[request.session_id] = {
        "status": status,
        "missing_information": missing_information,
        "project_spec": project_spec,
        "assistant_message": assistant_message,
    }

    return OnboardingChatResponse(
        message=assistant_message,
        status=status,
        missing_information=missing_information,
        project_spec=project_spec,
        spec_saved=spec_saved,
    )

@app.get("/onboarding/spec", response_model=ProjectSpecResponse)
async def get_project_spec():
    """Return the persisted project specification if it exists."""
    document = _load_project_spec_document()
    if not document:
        return ProjectSpecResponse(exists=False)

    metadata = {
        "session_id": document.get("session_id"),
        "generated_at": document.get("generated_at"),
        "model": document.get("model"),
    }

    return ProjectSpecResponse(
        exists=True,
        project_spec=document.get("project_spec"),
        metadata=metadata,
    )

@app.post("/onboarding/prepare-project", response_model=PrepareProjectResponse)
async def prepare_project_workspace():
    """Transform the saved project spec into canvas metadata and placeholder files."""
    document = _load_project_spec_document()
    if not document or not document.get("project_spec"):
        raise HTTPException(status_code=404, detail="Project specification not found")

    plan = await _generate_metadata_from_spec(document["project_spec"])
    files_plan = plan.get("files") or []
    edges_plan_raw = plan.get("edges") or []

    if not isinstance(files_plan, list) or not files_plan:
        raise HTTPException(status_code=502, detail="Metadata planner did not produce any files")

    metadata_payload: Dict[str, Dict[str, Any]] = {}
    created_files: List[Dict[str, Any]] = []
    valid_edges: List[Dict[str, Any]] = [
        edge for edge in edges_plan_raw
        if isinstance(edge, dict) and edge.get("from") and edge.get("to")
    ]

    files_db.clear()

    for index, file_entry in enumerate(files_plan):
        if not isinstance(file_entry, dict):
            continue

        file_name = file_entry.get("file_name") or file_entry.get("path")
        if not file_name:
            continue

        node_id = file_entry.get("id") or file_name
        node_id = _slugify(str(node_id))
        label = file_entry.get("label") or os.path.basename(file_name)
        description = file_entry.get("description") or document["project_spec"].get("summary", "")
        x, y = _position_for_index(index)

        metadata_payload[node_id] = {
            "id": node_id,
            "type": "file",
            "description": description,
            "x": x,
            "y": y,
            "fileName": file_name,
        }

        file_path = os.path.join(CANVAS_DIR, file_name)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        if not os.path.exists(file_path):
            with open(file_path, "w", encoding="utf-8") as f:
                f.write("")

        files_db[node_id] = FileNode(
            id=node_id,
            label=label,
            x=x,
            y=y,
            status="idle",
            filePath=file_name,
            fileType=_infer_file_type_from_name(file_name),
            content="",
            isExpanded=False,
            isModified=False,
        )

        created_files.append({
            "id": node_id,
            "label": label,
            "file_name": file_name,
        })

    if not metadata_payload:
        raise HTTPException(status_code=502, detail="No valid file definitions produced by planner")

    save_metadata(metadata_payload)
    save_edges(valid_edges)

    return PrepareProjectResponse(
        message="Project workspace prepared",
        files_created=len(created_files),
        metadata_nodes=len(metadata_payload),
        edges_created=len(valid_edges),
        files=created_files,
        edges=valid_edges,
    )

# Letta agent models
class AgentMessage(BaseModel):
    role: str
    content: str

class AgentChatRequest(BaseModel):
    messages: List[AgentMessage]
    agent_id: Optional[str] = None

class AgentChatResponse(BaseModel):
    agent_id: str
    messages: List[dict]

# Letta agent endpoints
@app.get("/letta/health")
async def letta_health():
    """Health check for Letta agent"""
    return {
        "status": "healthy" if _agent else "not_initialized",
        "agent_id": _agent.id if _agent else None
    }

@app.post("/letta/chat", response_model=AgentChatResponse)
async def letta_chat(request: AgentChatRequest):
    """
    Send a message to the Letta agent.
    
    Args:
        request: Chat request with messages
        
    Returns:
        Chat response with agent messages
    """
    if not _client or not _agent:
        raise HTTPException(status_code=503, detail="Letta agent not initialized")
    
    try:
        # Convert messages to the format expected by Letta
        letta_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]
        
        # Send message to agent
        response = _client.agents.messages.create(
            agent_id=_agent.id,
            messages=letta_messages
        )
        
        # Convert response to dict format
        response_messages = []
        for msg in response.messages:
            msg_dict = {
                "message_type": msg.message_type,
            }
            
            if hasattr(msg, 'content'):
                msg_dict["content"] = msg.content
            if hasattr(msg, 'reasoning'):
                msg_dict["reasoning"] = msg.reasoning
            if hasattr(msg, 'tool_call'):
                msg_dict["tool_call"] = {
                    "name": msg.tool_call.name if msg.tool_call else None,
                    "arguments": msg.tool_call.arguments if msg.tool_call else None
                }
            if hasattr(msg, 'tool_return'):
                msg_dict["tool_return"] = msg.tool_return
            
            response_messages.append(msg_dict)
        
        return AgentChatResponse(
            agent_id=_agent.id,
            messages=response_messages
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

@app.post("/letta/generate-code")
async def generate_code_from_metadata():
    """
    Generate code for all files based on metadata.json descriptions.
    
    Returns:
        Response with generated code for each file
    """
    if not _client or not _agent:
        raise HTTPException(status_code=503, detail="Letta agent not initialized")
    
    try:
        # Load metadata
        metadata = load_metadata()
        
        if not metadata:
            return {"message": "No metadata found", "generated_files": []}
        
        generated_files = []
        
        # Process each file node in metadata
        for node_id, node_data in metadata.items():
            if node_data.get("type") == "file":
                description = node_data.get("description", "")
                file_name = node_data.get("fileName", f"file_{node_id}")
                
                if not description:
                    continue
                
                # Create prompt for code generation
                prompt = f"""Based on this description: "{description}", generate ONLY the complete code for a file named "{file_name}".

CRITICAL REQUIREMENTS:
- Generate ONLY the raw code content
- NO explanations, comments about the code, or markdown formatting
- NO "Here is the code:" or similar introductory text
- NO code blocks with triple backticks
- NO explanations after the code
- Just the pure, executable code content

Description: {description}
File name: {file_name}

Generate ONLY the code:"""
                
                # Send to Letta agent
                response = _client.agents.messages.create(
                    agent_id=_agent.id,
                    messages=[{"role": "user", "content": prompt}]
                )
                
                # Extract the generated code from the response
                generated_code = ""
                for msg in response.messages:
                    if msg.message_type == "assistant_message" and msg.content:
                        generated_code = msg.content
                        break
                
                if generated_code:
                    # Write the generated code to the file
                    file_path = os.path.join(CANVAS_DIR, file_name)
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(generated_code)
                    
                    # Update the file content in files_db
                    if node_id in files_db:
                        files_db[node_id].content = generated_code
                    
                    generated_files.append({
                        "node_id": node_id,
                        "file_name": file_name,
                        "description": description,
                        "code_length": len(generated_code)
                    })
        
        return {
            "message": f"Generated code for {len(generated_files)} files",
            "generated_files": generated_files
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating code: {str(e)}")

@app.post("/files/{file_id}/generate")
async def generate_file_code(file_id: str):
    """
    Generate code for a specific file based on its description in metadata.
    
    Args:
        file_id: ID of the file node to generate code for
        
    Returns:
        Response with generation result
    """
    if not _client or not _agent:
        raise HTTPException(status_code=503, detail="Letta agent not initialized")
    
    try:
        # Load metadata
        metadata = load_metadata()
        
        if file_id not in metadata:
            raise HTTPException(status_code=404, detail="File node not found in metadata")
        
        node_data = metadata[file_id]
        if node_data.get("type") != "file":
            raise HTTPException(status_code=400, detail="Node is not a file type")
        
        description = node_data.get("description", "")
        file_name = node_data.get("fileName", f"file_{file_id}")
        
        if not description:
            raise HTTPException(status_code=400, detail="No description found for this file node")
        
        write_output(f"🔄 Generating {file_name}...", "INFO")
        write_output(f"   Description: {description}", "INFO")
        
        # Create prompt for code generation
        prompt = f"""Based on this description: "{description}", generate ONLY the complete code for a file named "{file_name}".

CRITICAL REQUIREMENTS:
- Generate ONLY the raw code content
- NO explanations, comments about the code, or markdown formatting
- NO "Here is the code:" or similar introductory text
- NO code blocks with triple backticks
- NO explanations after the code
- Just the pure, executable code content

Description: {description}
File name: {file_name}

Generate ONLY the code:"""
        
        # Send to Letta agent
        response = _client.agents.messages.create(
            agent_id=_agent.id,
            messages=[{"role": "user", "content": prompt}]
        )
        
        # Extract the generated code from the response
        generated_code = ""
        for msg in response.messages:
            if msg.message_type == "assistant_message" and msg.content:
                generated_code = msg.content
                break
        
        if not generated_code:
            write_output(f"❌ Failed to generate code for {file_name}", "ERROR")
            raise HTTPException(status_code=500, detail="Failed to generate code")
        
        # Write the generated code to the file
        file_path = os.path.join(CANVAS_DIR, file_name)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(generated_code)
        
        # Update the file content in files_db
        if file_id in files_db:
            files_db[file_id].content = generated_code
        
        write_output(f"✅ Generated {file_name} ({len(generated_code)} chars)", "SUCCESS")
        
        return {
            "message": f"Successfully generated code for {file_name}",
            "file_id": file_id,
            "file_name": file_name,
            "description": description,
            "code_length": len(generated_code)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        write_output(f"❌ ERROR generating {file_id}: {str(e)}", "ERROR")
        raise HTTPException(status_code=500, detail=f"Error generating code: {str(e)}")

@app.post("/run")
async def run_project():
    """
    Run the project by generating code for all files based on metadata.
    Returns progress data for frontend console display.
    
    Returns:
        Response with generation results and progress
    """
    if not _client or not _agent:
        raise HTTPException(status_code=503, detail="Letta agent not initialized")
    
    try:
        # Clear previous output and start fresh
        clear_output()
        
        # Load metadata
        metadata = load_metadata()
        
        if not metadata:
            write_output("❌ No metadata found", "ERROR")
            return {"message": "No metadata found", "generated_files": [], "progress": []}
        
        generated_files = []
        total_files = sum(1 for node_data in metadata.values() if node_data.get("type") == "file")
        
        if total_files == 0:
            write_output("❌ No file nodes found in metadata", "ERROR")
            return {"message": "No file nodes found", "generated_files": [], "progress": []}
        
        write_output("🚀 Starting project generation...", "INFO")
        write_output(f"📋 Found {len(metadata)} nodes in metadata", "INFO")
        write_output(f"📁 Processing {total_files} files...", "INFO")
        
        # Process each file node in metadata
        for i, (node_id, node_data) in enumerate(metadata.items(), 1):
            if node_data.get("type") == "file":
                description = node_data.get("description", "")
                file_name = node_data.get("fileName", f"file_{node_id}")
                
                if not description:
                    write_output(f"⏭️  [{i}/{total_files}] Skipping {file_name} (no description)", "INFO")
                    continue
                
                write_output(f"🔄 [{i}/{total_files}] Generating {file_name}...", "INFO")
                write_output(f"   Description: {description}", "INFO")
                
                # Create prompt for code generation
                prompt = f"""Based on this description: "{description}", generate ONLY the complete code for a file named "{file_name}".

CRITICAL REQUIREMENTS:
- Generate ONLY the raw code content
- NO explanations, comments about the code, or markdown formatting
- NO "Here is the code:" or similar introductory text
- NO code blocks with triple backticks
- NO explanations after the code
- Just the pure, executable code content

Description: {description}
File name: {file_name}

Generate ONLY the code:"""
                
                # Send to Letta agent
                response = _client.agents.messages.create(
                    agent_id=_agent.id,
                    messages=[{"role": "user", "content": prompt}]
                )
                
                # Extract the generated code from the response
                generated_code = ""
                for msg in response.messages:
                    if msg.message_type == "assistant_message" and msg.content:
                        generated_code = msg.content
                        break
                
                if generated_code:
                    # Write the generated code to the file
                    file_path = os.path.join(CANVAS_DIR, file_name)
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(generated_code)
                    
                    # Update the file content in files_db
                    if node_id in files_db:
                        files_db[node_id].content = generated_code
                    
                    write_output(f"✅ [{i}/{total_files}] Generated {file_name} ({len(generated_code)} chars)", "SUCCESS")
                    
                    generated_files.append({
                        "node_id": node_id,
                        "file_name": file_name,
                        "description": description,
                        "code_length": len(generated_code)
                    })
                else:
                    write_output(f"❌ [{i}/{total_files}] Failed to generate code for {file_name}", "ERROR")
        
        write_output(f"🎉 Generation complete!", "SUCCESS")
        write_output(f"📊 Generated {len(generated_files)} files successfully", "SUCCESS")
        
        return {
            "message": f"Generated code for {len(generated_files)} files",
            "generated_files": generated_files,
            "total_processed": len(generated_files)
        }
        
    except Exception as e:
        write_output(f"❌ ERROR: {str(e)}", "ERROR")
        return {
            "message": f"Error generating code: {str(e)}",
            "generated_files": [],
            "total_processed": 0
        }

@app.get("/letta/info")
async def get_letta_info():
    """Get information about the Letta agent"""
    if not _agent:
        raise HTTPException(status_code=503, detail="Letta agent not initialized")
    
    return {
        "agent_id": _agent.id,
        "status": "active",
        "tools_count": len(_agent.tools) if hasattr(_agent, 'tools') else 0
    }

# Load existing files on startup
load_existing_files()

# Initialize workspace manager and terminal executor
if WorkspaceManager and TerminalExecutor:
    workspace_manager = WorkspaceManager()
    terminal = TerminalExecutor()
else:
    workspace_manager = None
    terminal = None
    print("Workspace and Terminal features disabled")

# ==================== WORKSPACE ENDPOINTS ====================

@app.get("/workspace/list")
async def list_workspaces():
    """List all workspaces in canvas directory"""
    workspaces = workspace_manager.list_workspaces()
    active = workspace_manager.get_active_workspace()
    
    return {
        "workspaces": workspaces,
        "active_workspace": active
    }

@app.post("/workspace/set-active")
async def set_active_workspace(workspace_name: str):
    """Set active workspace"""
    result = workspace_manager.set_active_workspace(workspace_name)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@app.get("/workspace/active")
async def get_active_workspace():
    """Get active workspace"""
    # Ensure active workspace is set (auto-selects first workspace if needed)
    workspace_info = workspace_manager.ensure_active_workspace()
    if not workspace_info["success"]:
        return {"workspace": None}
    return {"workspace": workspace_info["workspace"]}

# ==================== TERMINAL ENDPOINTS ====================

class TerminalCommand(BaseModel):
    command: str

@app.post("/terminal/execute")
async def execute_terminal_command(cmd: TerminalCommand):
    """
    Execute ANY terminal command in workspace.
    
    CRITICAL: Command executes ONLY in backend/canvas/workspace/
    """
    # Get workspace
    workspace_info = workspace_manager.ensure_active_workspace()
    if not workspace_info["success"]:
        raise HTTPException(status_code=400, detail=workspace_info["error"])
    
    workspace_path = workspace_info["workspace"]
    
    # Execute command in workspace
    result = terminal.execute(cmd.command, workspace_path)
    
    # If command was git clone, update active workspace
    if cmd.command.startswith("git clone"):
        # Extract repo name from clone command
        # git clone https://github.com/user/repo.git
        parts = cmd.command.split()
        if len(parts) >= 3:
            repo_url = parts[-1]  # Last part is the URL
            repo_name = repo_url.split('/')[-1].replace('.git', '')
            # Auto-set as active workspace
            workspace_manager.set_active_workspace(repo_name)
    
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
