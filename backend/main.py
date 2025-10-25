from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json

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

class NodeMetadata(BaseModel):
    id: str
    type: str
    description: str
    x: float
    y: float

# In-memory storage for demo (replace with database later)
files_db = {}

# Ensure canvas/files directory exists
CANVAS_DIR = os.path.join(os.path.dirname(__file__), "..", "canvas", "files")
os.makedirs(CANVAS_DIR, exist_ok=True)

# Metadata file path
METADATA_FILE = os.path.join(os.path.dirname(__file__), "..", "canvas", "metadata.json")

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
    metadata[node_id] = {
        "id": node_id,
        "type": node_type,
        "description": description,
        "x": x,
        "y": y
    }
    save_metadata(metadata)

def remove_node_metadata(node_id: str):
    """Remove metadata for a specific node"""
    metadata = load_metadata()
    if node_id in metadata:
        del metadata[node_id]
        save_metadata(metadata)

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
    
    # Update metadata
    description = f"File: {file_create.filePath} ({file_create.fileType})"
    update_node_metadata(file_id, "file", description, new_file.x, new_file.y)
    
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
    description = f"File: {node.filePath} ({node.fileType})"
    update_node_metadata(file_id, "file", description, x, y)
    
    return {"message": "File position updated successfully"}

@app.get("/metadata")
async def get_metadata():
    """Get all node metadata"""
    return load_metadata()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
