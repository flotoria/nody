"""
Main FastAPI application for Nody VDE Backend.
"""
import json
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import API_TITLE, API_VERSION, CORS_ORIGINS, EDGES_FILE
from models import (
    FileNode, FileContent, FileCreate, DescriptionUpdate, NodeMetadata,
    OnboardingChatRequest, OnboardingChatResponse, ProjectSpecResponse, PrepareProjectResponse,
    AgentChatRequest, AgentChatResponse, TerminalCommand,
    FolderNode, FolderCreate, FolderUpdate
)
from database import file_db, output_logger
from onboarding import onboarding_service
from code_generation import code_generation_service
from workspace import workspace_service


# Create FastAPI app
app = FastAPI(title=API_TITLE, version=API_VERSION)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    try:
        await code_generation_service.initialize()
        print("All services initialized successfully")
    except Exception as e:
        print(f"Failed to initialize services: {e}")


# ==================== FILE OPERATIONS ====================

@app.get("/")
async def root():
    return {"message": "Nody VDE Backend API"}


@app.get("/files", response_model=list[FileNode])
async def get_files():
    """Get all node files"""
    return file_db.get_all_files()


@app.get("/files/{file_id}", response_model=FileNode)
async def get_file(file_id: str):
    """Get a specific node file"""
    file_node = file_db.get_file(file_id)
    if not file_node:
        raise HTTPException(status_code=404, detail="File not found")
    return file_node


@app.put("/files/{file_id}/content")
async def update_file_content(file_id: str, file_content: FileContent):
    """Update file content"""
    try:
        file_db.update_file_content(file_id, file_content.content)
        return {"message": "File content updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/files", response_model=FileNode)
async def create_file(file_create: FileCreate):
    """Create a new node file"""
    try:
        file_data = {
            "filePath": file_create.filePath,
            "fileType": file_create.fileType,
            "content": file_create.content,
            "description": file_create.description
        }
        new_file = file_db.create_file(file_data)
        return new_file
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """Delete a node file"""
    try:
        file_db.delete_file(file_id)
        return {"message": "File deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.put("/files/{file_id}/position")
async def update_file_position(file_id: str, x: float, y: float):
    """Update node file position"""
    try:
        file_db.update_file_position(file_id, x, y)
        return {"message": "File position updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.put("/files/{file_id}/description")
async def update_file_description(file_id: str, description_update: DescriptionUpdate):
    """Update node file description"""
    try:
        file_db.update_file_description(file_id, description_update.description)
        return {"message": "File description updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/files/{file_id}/generate")
async def generate_file_code(file_id: str):
    """Generate code for a specific node file based on its description in metadata."""
    try:
        result = await code_generation_service.generate_file_code(file_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating code: {str(e)}")


# ==================== FOLDER OPERATIONS ====================

@app.get("/folders", response_model=list[FolderNode])
async def get_folders():
    """Get all folder nodes"""
    metadata = file_db.load_metadata()
    folders = []
    for node_id, node_data in metadata.items():
        if node_data.get("type") == "folder":
            folders.append(FolderNode(
                id=node_id,
                name=node_data.get("name", f"Folder {node_id}"),
                x=node_data.get("x", 100),
                y=node_data.get("y", 100),
                width=node_data.get("width", 600),
                height=node_data.get("height", 400),
                isExpanded=node_data.get("isExpanded", True),
                containedFiles=node_data.get("containedFiles", []),
                parentFolder=node_data.get("parentFolder")
            ))
    return folders


@app.post("/folders", response_model=FolderNode)
async def create_folder(folder_create: FolderCreate):
    """Create a new folder node"""
    try:
        metadata = file_db.load_metadata()
        
        # Generate unique folder ID
        folder_id = f"folder_{len([k for k in metadata.keys() if k.startswith('folder_')]) + 1}"
        
        # Create folder metadata
        folder_data = {
            "id": folder_id,
            "type": "folder",
            "name": folder_create.name,
            "x": folder_create.x,
            "y": folder_create.y,
            "width": folder_create.width,
            "height": folder_create.height,
            "isExpanded": True,
            "containedFiles": [],
            "parentFolder": folder_create.parentFolder,
            "description": f"Folder: {folder_create.name}"
        }
        
        metadata[folder_id] = folder_data
        file_db.save_metadata(metadata)
        
        return FolderNode(**folder_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating folder: {str(e)}")


@app.put("/folders/{folder_id}")
async def update_folder(folder_id: str, folder_update: FolderUpdate):
    """Update folder properties"""
    try:
        metadata = file_db.load_metadata()
        
        if folder_id not in metadata or metadata[folder_id].get("type") != "folder":
            raise HTTPException(status_code=404, detail="Folder not found")
        
        # Update folder properties
        if folder_update.name is not None:
            metadata[folder_id]["name"] = folder_update.name
        if folder_update.x is not None:
            metadata[folder_id]["x"] = folder_update.x
        if folder_update.y is not None:
            metadata[folder_id]["y"] = folder_update.y
        if folder_update.width is not None:
            metadata[folder_id]["width"] = folder_update.width
        if folder_update.height is not None:
            metadata[folder_id]["height"] = folder_update.height
        if folder_update.isExpanded is not None:
            metadata[folder_id]["isExpanded"] = folder_update.isExpanded
        if folder_update.containedFiles is not None:
            metadata[folder_id]["containedFiles"] = folder_update.containedFiles
        
        file_db.save_metadata(metadata)
        
        return {"message": "Folder updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating folder: {str(e)}")


@app.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str):
    """Delete a folder node"""
    try:
        metadata = file_db.load_metadata()
        
        if folder_id not in metadata or metadata[folder_id].get("type") != "folder":
            raise HTTPException(status_code=404, detail="Folder not found")
        
        # Remove folder from metadata
        del metadata[folder_id]
        
        # Remove parentFolder reference from contained files
        for node_id, node_data in metadata.items():
            if node_data.get("parentFolder") == folder_id:
                node_data["parentFolder"] = None
        
        file_db.save_metadata(metadata)
        
        return {"message": "Folder deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting folder: {str(e)}")


@app.put("/files/{file_id}/folder")
async def move_file_to_folder(file_id: str, folder_id: Optional[str] = None):
    """Move node file to a folder (or remove from folder if folder_id is None)"""
    try:
        metadata = file_db.load_metadata()
        
        if file_id not in metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Update file's parent folder
        old_folder_id = metadata[file_id].get("parentFolder")
        metadata[file_id]["parentFolder"] = folder_id
        
        # Remove file from old folder's containedFiles
        if old_folder_id and old_folder_id in metadata:
            if "containedFiles" in metadata[old_folder_id]:
                metadata[old_folder_id]["containedFiles"] = [
                    f for f in metadata[old_folder_id]["containedFiles"] if f != file_id
                ]
        
        # Add file to new folder's containedFiles
        if folder_id and folder_id in metadata:
            if "containedFiles" not in metadata[folder_id]:
                metadata[folder_id]["containedFiles"] = []
            if file_id not in metadata[folder_id]["containedFiles"]:
                metadata[folder_id]["containedFiles"].append(file_id)
        
        file_db.save_metadata(metadata)
        
        return {"message": "File moved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error moving file: {str(e)}")


# ==================== METADATA OPERATIONS ====================

@app.get("/metadata")
async def get_metadata():
    """Get all node metadata"""
    return file_db.load_metadata()


@app.put("/metadata")
async def update_metadata(metadata: dict):
    """Update all node metadata"""
    try:
        file_db.save_metadata(metadata)
        return {"message": "Metadata updated successfully"}
    except Exception as e:
        print(f"Error updating metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating metadata: {str(e)}")


@app.get("/edges")
async def get_edges():
    """Get all edges"""
    try:
        if EDGES_FILE.exists():
            with open(EDGES_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get("edges", [])
        return []
    except Exception as e:
        print(f"Error loading edges: {e}")
        return []


@app.post("/edges")
async def create_edge(edge_data: dict):
    """Create a new edge or clear all edges"""
    try:
        # If edge_data contains "edges" key, it's a clear operation
        if "edges" in edge_data:
            edges_data = {"edges": edge_data["edges"]}
            with open(EDGES_FILE, 'w', encoding='utf-8') as f:
                json.dump(edges_data, f, indent=2)
            return {"message": "Edges updated successfully"}
        
        # Otherwise, create a new edge
        # Load existing edges
        edges = []
        if EDGES_FILE.exists():
            with open(EDGES_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                edges = data.get("edges", [])
        
        # Check for duplicate edges
        for existing_edge in edges:
            if (existing_edge.get("from") == edge_data.get("from") and 
                existing_edge.get("to") == edge_data.get("to")):
                raise HTTPException(status_code=400, detail="Edge already exists")
        
        # Add new edge
        edges.append(edge_data)
        
        # Save updated edges
        edges_data = {"edges": edges}
        with open(EDGES_FILE, 'w', encoding='utf-8') as f:
            json.dump(edges_data, f, indent=2)
        
        return {"message": "Edge created successfully", "edge": edge_data}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating edge: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating edge: {str(e)}")


@app.delete("/edges")
async def delete_edge(from_node: str, to_node: str, edge_type: str):
    """Delete a specific edge by from/to/type combination"""
    try:
        # Load existing edges
        edges = []
        if EDGES_FILE.exists():
            with open(EDGES_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                edges = data.get("edges", [])
        
        # Find and remove the edge
        original_count = len(edges)
        edges = [edge for edge in edges if not (
            edge.get("from") == from_node and 
            edge.get("to") == to_node and 
            edge.get("type") == edge_type
        )]
        
        if len(edges) == original_count:
            raise HTTPException(status_code=404, detail="Edge not found")
        
        # Save updated edges
        edges_data = {"edges": edges}
        with open(EDGES_FILE, 'w', encoding='utf-8') as f:
            json.dump(edges_data, f, indent=2)
        
        return {"message": "Edge deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting edge: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting edge: {str(e)}")


# ==================== OUTPUT OPERATIONS ====================

@app.get("/output")
async def get_output():
    """Get real-time output messages"""
    return output_logger.get_output()


@app.post("/output/clear")
async def clear_output_endpoint():
    """Clear the output file"""
    output_logger.clear_output()
    return {"message": "Output cleared"}


# ==================== ONBOARDING OPERATIONS ====================

@app.post("/onboarding/chat", response_model=OnboardingChatResponse)
async def onboarding_chat(request: OnboardingChatRequest):
    """Handle onboarding conversation using Groq to gather project specifications."""
    try:
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        result = await onboarding_service.process_chat(request.session_id, messages)
        return OnboardingChatResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing onboarding chat: {str(e)}")


@app.get("/onboarding/spec", response_model=ProjectSpecResponse)
async def get_project_spec():
    """Return the persisted project specification if it exists."""
    result = onboarding_service.get_project_spec()
    return ProjectSpecResponse(**result)


@app.post("/onboarding/prepare-project", response_model=PrepareProjectResponse)
async def prepare_project_workspace():
    """Transform the saved project spec into canvas metadata and placeholder files."""
    try:
        project_spec_doc = onboarding_service.load_project_spec_document()
        if not project_spec_doc or not project_spec_doc.get("project_spec"):
            raise HTTPException(status_code=404, detail="Project specification not found")

        result = await code_generation_service.prepare_project_workspace(project_spec_doc["project_spec"])
        return PrepareProjectResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error preparing project: {str(e)}")


# ==================== LETTA AGENT OPERATIONS ====================

@app.get("/letta/health")
async def letta_health():
    """Health check for Letta agent"""
    return {
        "status": "healthy" if code_generation_service.is_initialized() else "not_initialized",
        "agent_id": code_generation_service.agent.id if code_generation_service.is_initialized() else None
    }


@app.post("/letta/chat", response_model=AgentChatResponse)
async def letta_chat(request: AgentChatRequest):
    """Send a message to the Letta agent."""
    try:
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        result = await code_generation_service.chat_with_agent(messages)
        return AgentChatResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")


@app.post("/letta/generate-code")
async def generate_code_from_metadata():
    """Generate code for all files based on metadata.json descriptions."""
    try:
        result = await code_generation_service.run_project()
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating code: {str(e)}")


@app.get("/letta/info")
async def get_letta_info():
    """Get information about the Letta agent"""
    try:
        return code_generation_service.get_agent_info()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting agent info: {str(e)}")


# ==================== PROJECT EXECUTION ====================

@app.post("/run")
async def run_project():
    """Run the project by generating code for all files based on metadata."""
    try:
        result = await code_generation_service.run_project()
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running project: {str(e)}")


# ==================== WORKSPACE OPERATIONS ====================

@app.get("/workspace/list")
async def list_workspaces():
    """List all workspaces in canvas directory"""
    return workspace_service.list_workspaces()
    

@app.post("/workspace/set-active")
async def set_active_workspace(workspace_name: str):
    """Set active workspace"""
    return workspace_service.set_active_workspace(workspace_name)


@app.get("/workspace/active")
async def get_active_workspace():
    """Get active workspace"""
    return workspace_service.get_active_workspace()


# ==================== TERMINAL OPERATIONS ====================

@app.post("/terminal/execute")
async def execute_terminal_command(cmd: TerminalCommand):
    """Execute ANY terminal command in workspace."""
    try:
        result = workspace_service.execute_terminal_command(cmd.command)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error executing command: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
