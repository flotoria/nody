"""
Main FastAPI application for Nody VDE Backend.
"""
import json
from typing import Optional, List, Dict
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
from datetime import datetime
import subprocess
import threading
import re
import signal
from dotenv import load_dotenv
from letta_client import Letta
from agents import create_file_system_agent, create_node_generation_agent, generate_nodes_from_conversation

from config import API_TITLE, API_VERSION, CORS_ORIGINS, EDGES_FILE, METADATA_FILE, CANVAS_DIR, BACKEND_ROOT
from models import (
    FileNode, FileContent, FileCreate, DescriptionUpdate, NodeMetadata,
    OnboardingChatRequest, OnboardingChatResponse, ProjectSpecResponse, PrepareProjectResponse,
    AgentChatRequest, AgentChatResponse, AgentMessage, TerminalCommand,
    FolderNode, FolderCreate, FolderUpdate
)
from database import file_db, output_logger
from onboarding import onboarding_service
from code_generation import code_generation_service
from workspace import workspace_service, WorkspaceManager

# Initialize workspace manager
workspace_manager = WorkspaceManager()

RUN_APP_PROCESS: Optional[subprocess.Popen] = None
RUN_APP_THREAD: Optional[threading.Thread] = None
RUN_APP_LOCK = threading.Lock()

# Track running file processes for server applications
RUNNING_FILE_PROCESSES: Dict[str, subprocess.Popen] = {}
RUNNING_FILE_LOCKS = threading.Lock()

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


# Agent setup
_client = None
_agent = None
_node_gen_client = None
_node_gen_agent_config = None

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    global _client, _agent, _node_gen_client, _node_gen_agent_config
    try:
        # Initialize code generation service
        await code_generation_service.initialize()
        print("Code generation service initialized")
        
        # Initialize Letta agents
        _client, _agent = create_file_system_agent()
        print(f"Letta agent initialized with ID: {_agent.id}")
        
        # Initialize node generation agent
        _node_gen_client, _node_gen_agent_config = create_node_generation_agent()
        print("Node generation agent initialized")
        
        print("All services initialized successfully")
    except Exception as e:
        print(f"Failed to initialize services: {e}")
        print("Make sure you have:")
        print("1. Set LETTA_API_KEY environment variable for Letta Cloud, OR")
        print("2. Started a self-hosted Letta server and set LETTA_BASE_URL")
        print("3. Set ANTHROPIC_API_KEY environment variable")


# ==================== PORT CLEANUP HELPERS ====================

def _extract_port_from_command(command: str) -> Optional[int]:
    """Extract port number from a command string."""
    # Match --port XXXX or --port=XXXX
    port_match = re.search(r'--port[=\s]+(\d+)', command)
    if port_match:
        return int(port_match.group(1))
    
    # Match :XXXX for other server formats
    port_match = re.search(r':(\d+)\b', command)
    if port_match:
        return int(port_match.group(1))
    
    return None


def _kill_process_on_port(port: int) -> bool:
    """Kill any process using the specified port."""
    try:
        # Use lsof to find process on port
        result = subprocess.run(
            ['lsof', '-ti', f':{port}'],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0 and result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                try:
                    # Kill the process
                    subprocess.run(['kill', '-9', pid], check=True)
                    output_logger.write_output(f"🔥 Killed existing process (PID: {pid}) on port {port}", "INFO")
                except subprocess.CalledProcessError:
                    pass
            return True
        return False
    except Exception as e:
        print(f"Error killing process on port {port}: {e}")
        return False


# ==================== FILE OPERATIONS ====================

def create_empty_files_for_metadata():
    """Create empty Python files for all nodes in metadata that don't have files yet"""
    try:
        metadata = load_metadata()
        created_files = []
        
        for node_id, node_meta in metadata.items():
            if node_meta.get("type") == "file":
                file_name = node_meta.get("fileName", f"file_{node_id}.py")
                file_path = os.path.join(CANVAS_DIR, file_name)
                
                # Create empty file if it doesn't exist
                if not os.path.exists(file_path):
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write("# Empty Python file\n")
                    created_files.append(file_name)
                    print(f"Created empty file: {file_name}")
        
        return created_files
    except Exception as e:
        print(f"Error creating empty files: {e}")
        return []

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


@app.post("/canvas/clear")
async def clear_canvas():
    """Clear the entire canvas - all files, metadata, and edges"""
    try:
        # Clear edges
        EDGES_FILE.write_text(json.dumps({"edges": []}, indent=2), encoding='utf-8')
        
        # Clear metadata
        METADATA_FILE.write_text(json.dumps({}, indent=2), encoding='utf-8')
        
        # Clear files from filesystem
        import shutil
        if CANVAS_DIR.exists():
            shutil.rmtree(CANVAS_DIR)
            CANVAS_DIR.mkdir(exist_ok=True)
        
        # Clear in-memory database
        file_db.files_db.clear()
        
        # Clear output
        output_logger.clear_output()
        
        return {"message": "Canvas cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing canvas: {str(e)}")


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


@app.get("/files/{file_id}/run")
async def run_file(file_id: str):
    """Run a file with streaming output (Server-Sent Events)."""
    from fastapi.responses import StreamingResponse
    import asyncio
    
    try:
        # Get file metadata and content
        metadata = file_db.load_metadata()
        if file_id not in metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        node_data = metadata[file_id]
        if node_data.get("type") != "file":
            raise HTTPException(status_code=400, detail="Node is not a file type")
        
        file_name = node_data.get("fileName", f"file_{file_id}")
        file_path = CANVAS_DIR / file_name
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File does not exist on filesystem")
        
        # Read file content
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")
        
        # Determine run command based on file type and content
        command = _determine_run_command(file_name, content)
        if not command:
            raise HTTPException(status_code=400, detail="File type is not runnable")
        
        # Check if already running
        with RUNNING_FILE_LOCKS:
            if file_id in RUNNING_FILE_PROCESSES:
                process = RUNNING_FILE_PROCESSES[file_id]
                if process.poll() is None:
                    raise HTTPException(
                        status_code=409, 
                        detail=f"File is already running (PID: {process.pid})"
                    )
                else:
                    # Process finished, remove it
                    del RUNNING_FILE_PROCESSES[file_id]
        
        # Determine working directory
        working_dir = _determine_working_directory(file_path)
        
        async def stream_output():
            """Stream file execution output"""
            global RUNNING_FILE_PROCESSES
            process = None
            
            try:
                # Check if command uses a port and clean it up if necessary
                port = _extract_port_from_command(command)
                if port:
                    if _kill_process_on_port(port):
                        output_logger.write_output(f"🧹 Cleaned up port {port}", "INFO")
                
                # Log command
                output_logger.write_output(f"🚀 Running {file_name}...", "INFO")
                output_logger.write_output(f"$ {command}", "INFO")
                command_output = f"$ {command}\n"
                yield f"data: {json.dumps({'output': command_output})}\n\n"
                
                # Start process with new session to allow killing entire process group
                process = subprocess.Popen(
                    command,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    cwd=str(working_dir),
                    start_new_session=True  # Create new process group
                )
                
                # Store process handle
                with RUNNING_FILE_LOCKS:
                    RUNNING_FILE_PROCESSES[file_id] = process
                    print(f"DEBUG: Started file {file_id} with PID {process.pid}")
                    print(f"DEBUG: Running files now: {list(RUNNING_FILE_PROCESSES.keys())}")
                
                yield f"data: {json.dumps({'pid': process.pid, 'file_id': file_id})}\n\n"
                
                # Stream output line by line
                for line in iter(process.stdout.readline, ''):
                    if line:
                        output_logger.write_output(line.rstrip(), "INFO")
                        yield f"data: {json.dumps({'output': line})}\n\n"
                        await asyncio.sleep(0.01)
                
                # Wait for process to complete
                process.wait()
                
                # Send completion status
                if process.returncode == 0:
                    output_logger.write_output(f"✅ {file_name} completed successfully", "SUCCESS")
                    yield f"data: {json.dumps({'done': True, 'return_code': process.returncode, 'success': True})}\n\n"
                else:
                    output_logger.write_output(f"❌ {file_name} exited with code {process.returncode}", "ERROR")
                    yield f"data: {json.dumps({'done': True, 'return_code': process.returncode, 'success': False})}\n\n"
                
                # Clean up process handle when it actually finishes
                with RUNNING_FILE_LOCKS:
                    if file_id in RUNNING_FILE_PROCESSES:
                        del RUNNING_FILE_PROCESSES[file_id]
                        print(f"DEBUG: Process {file_id} finished, removed from tracking")
                
            except Exception as e:
                error_msg = f"Error running file: {str(e)}"
                output_logger.write_output(error_msg, "ERROR")
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
            finally:
                # Only clean up if there was an error starting the process
                if process is None and file_id in RUNNING_FILE_PROCESSES:
                    with RUNNING_FILE_LOCKS:
                        if file_id in RUNNING_FILE_PROCESSES:
                            del RUNNING_FILE_PROCESSES[file_id]
        
        return StreamingResponse(stream_output(), media_type="text/event-stream")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running file: {str(e)}")


@app.post("/files/{file_id}/stop")
async def stop_file(file_id: str):
    """Stop a running file process."""
    global RUNNING_FILE_PROCESSES
    
    # Debug logging
    print(f"DEBUG: Stop requested for file_id: {file_id}")
    print(f"DEBUG: Currently running files: {list(RUNNING_FILE_PROCESSES.keys())}")
    
    with RUNNING_FILE_LOCKS:
        if file_id not in RUNNING_FILE_PROCESSES:
            print(f"DEBUG: File {file_id} not found in running processes")
            raise HTTPException(status_code=404, detail="File is not currently running")
        
        process = RUNNING_FILE_PROCESSES[file_id]
        
        # Check if process is still running
        if process.poll() is not None:
            # Process already finished
            del RUNNING_FILE_PROCESSES[file_id]
            raise HTTPException(status_code=404, detail="File process has already finished")
        
        try:
            # Get file metadata for logging
            metadata = file_db.load_metadata()
            file_name = metadata.get(file_id, {}).get("fileName", file_id)
            
            # Try graceful termination first - kill entire process group
            try:
                pgid = os.getpgid(process.pid)
                os.killpg(pgid, signal.SIGTERM)
                output_logger.write_output(f"🛑 Stopping {file_name} (PID: {process.pid}, PGID: {pgid})...", "INFO")
            except (ProcessLookupError, PermissionError) as e:
                # Fallback to killing just the process if process group doesn't exist
                process.terminate()
                output_logger.write_output(f"🛑 Stopping {file_name} (PID: {process.pid})...", "INFO")
            
            # Wait up to 5 seconds for graceful shutdown
            try:
                process.wait(timeout=5)
                output_logger.write_output(f"✅ {file_name} stopped gracefully", "SUCCESS")
            except subprocess.TimeoutExpired:
                # Force kill if graceful shutdown fails - kill entire process group
                try:
                    pgid = os.getpgid(process.pid)
                    os.killpg(pgid, signal.SIGKILL)
                    output_logger.write_output(f"⚠️  {file_name} force killed (entire process group)", "INFO")
                except (ProcessLookupError, PermissionError):
                    # Fallback to killing just the process
                    process.kill()
                    output_logger.write_output(f"⚠️  {file_name} force killed", "INFO")
                process.wait()
            
            # Remove from tracking
            del RUNNING_FILE_PROCESSES[file_id]
            
            return {
                "success": True,
                "message": f"Successfully stopped {file_name}",
                "file_id": file_id
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to stop process: {str(e)}"
            }


@app.get("/files/{file_id}/status")
async def get_file_status(file_id: str):
    """Get the running status of a file."""
    with RUNNING_FILE_LOCKS:
        if file_id not in RUNNING_FILE_PROCESSES:
            return {
                "file_id": file_id,
                "status": "not_running",
                "running": False
            }
        
        process = RUNNING_FILE_PROCESSES[file_id]
        
        # Check if process is still running
        if process.poll() is None:
            return {
                "file_id": file_id,
                "status": "running",
                "running": True,
                "pid": process.pid
            }
        else:
            # Process finished, clean up
            return_code = process.returncode
            del RUNNING_FILE_PROCESSES[file_id]
            return {
                "file_id": file_id,
                "status": "finished",
                "running": False,
                "return_code": return_code
            }


def _determine_run_command(file_name: str, content: str) -> str:
    """Determine the appropriate run command for a file based on its type and content."""
    file_ext = file_name.lower().split('.')[-1] if '.' in file_name else ''
    
    # Python files
    if file_ext == 'py':
        # Check for FastAPI - always use uvicorn
        if 'from fastapi import' in content or 'FastAPI(' in content:
            module_name = file_name.replace('.py', '')
            return f"uvicorn {module_name}:app --reload --host 0.0.0.0 --port 8001"
        # Check for Flask
        elif 'from flask import' in content or 'Flask(' in content:
            return f"python {file_name}"
        # Check for Django
        elif 'django' in content.lower() or 'manage.py' in file_name:
            return f"python {file_name}"
        # Regular Python script
        else:
            return f"python {file_name}"
    
    # Node.js files
    elif file_ext == 'js':
        # Check for Express
        if 'express' in content.lower() or 'app.listen' in content:
            return f"node {file_name}"
        # Regular Node.js script
        else:
            return f"node {file_name}"
    
    # TypeScript files
    elif file_ext == 'ts':
        return f"ts-node {file_name}"
    
    # Shell scripts
    elif file_ext == 'sh':
        return f"bash {file_name}"
    
    # Batch files
    elif file_ext == 'bat':
        return file_name
    
    # PowerShell files
    elif file_ext == 'ps1':
        return f"powershell {file_name}"
    
    # Not runnable
    return None


def _determine_working_directory(file_path: Path) -> Path:
    """Determine the appropriate working directory for running a file."""
    # For now, use the file's directory
    # This could be enhanced to detect project root, etc.
    return file_path.parent


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
    """Create a new folder node and corresponding directory in filesystem"""
    try:
        metadata = file_db.load_metadata()
        
        # Generate unique folder ID
        folder_id = f"folder_{len([k for k in metadata.keys() if k.startswith('folder_')]) + 1}"
        
        # Create actual directory in canvas/nodes
        folder_path = CANVAS_DIR / folder_create.name
        folder_path.mkdir(parents=True, exist_ok=True)
        print(f"Created directory: {folder_path}")
        
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
            "description": f"Folder: {folder_create.name}",
            "folderPath": folder_create.name  # Store the folder path
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
    """Delete a folder node and its directory from filesystem"""
    try:
        metadata = file_db.load_metadata()
        
        if folder_id not in metadata or metadata[folder_id].get("type") != "folder":
            raise HTTPException(status_code=404, detail="Folder not found")
        
        # Get folder path and delete directory if it exists
        folder_name = metadata[folder_id].get("name")
        if folder_name:
            folder_path = CANVAS_DIR / folder_name
            if folder_path.exists() and folder_path.is_dir():
                import shutil
                shutil.rmtree(folder_path)
                print(f"Deleted directory: {folder_path}")
        
        # Remove folder from metadata
        del metadata[folder_id]
        
        # Delete all contained files (both from filesystem and metadata)
        files_to_delete = []
        for node_id, node_data in metadata.items():
            if node_data.get("parentFolder") == folder_id:
                files_to_delete.append(node_id)
        
        # Delete each contained file
        for file_id in files_to_delete:
            try:
                file_db.delete_file(file_id)
                del metadata[file_id]
            except Exception as e:
                print(f"Warning: Failed to delete contained file {file_id}: {e}")
        
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
        
        # Get file name and old/new folder paths
        file_name = metadata[file_id].get("fileName")
        if file_name:
            # Extract base filename (remove folder path if present)
            base_file_name = file_name.split("/")[-1] if "/" in file_name else file_name
            
            # Get old folder path
            old_folder_id = metadata[file_id].get("parentFolder")
            old_folder_name = metadata[old_folder_id].get("name") if old_folder_id and old_folder_id in metadata else None
            old_file_path = CANVAS_DIR / old_folder_name / base_file_name if old_folder_name else CANVAS_DIR / base_file_name
            
            # Get new folder path
            new_folder_name = metadata[folder_id].get("name") if folder_id and folder_id in metadata else None
            new_file_path = CANVAS_DIR / new_folder_name / base_file_name if new_folder_name else CANVAS_DIR / base_file_name
            
            # Move the actual file if it exists
            if old_file_path.exists() and old_file_path != new_file_path:
                new_file_path.parent.mkdir(parents=True, exist_ok=True)
                import shutil
                shutil.move(str(old_file_path), str(new_file_path))
                print(f"Moved file from {old_file_path} to {new_file_path}")
                
                # Update fileName in metadata to reflect new location
                if new_folder_name:
                    metadata[file_id]["fileName"] = f"{new_folder_name}/{base_file_name}"
                else:
                    metadata[file_id]["fileName"] = base_file_name
        
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

@app.get("/metadata/raw")
async def get_metadata_raw():
    """Get raw metadata.json content"""
    try:
        # Ensure the file exists
        if not METADATA_FILE.exists():
            # Create empty metadata file
            METADATA_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(METADATA_FILE, 'w', encoding='utf-8') as f:
                f.write('{}')
        
        with open(METADATA_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Add timestamp for debugging
        print(f"Metadata file read at {datetime.now()}, size: {len(content)} chars")
        
        return {"content": content}
    except Exception as e:
        print(f"Error reading metadata file: {e}")
        return {"content": "{}", "error": str(e)}

@app.get("/metadata")
async def get_metadata():
    """Get all node metadata"""
    return file_db.load_metadata()


@app.put("/metadata")
async def update_metadata(metadata: dict):
    """Update all node metadata"""
    try:
        print(f"Metadata update called at {datetime.now()}, nodes: {len(metadata)}")
        file_db.save_metadata(metadata)
        print(f"Metadata saved successfully, file size: {METADATA_FILE.stat().st_size if METADATA_FILE.exists() else 0} bytes")
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


# Node generation agent chat endpoint
class NodeChatRequest(BaseModel):
    messages: List[AgentMessage]

class NodeChatResponse(BaseModel):
    message: str
    generated_nodes: Optional[List[dict]] = None

@app.post("/chat/nodes", response_model=NodeChatResponse)
async def chat_nodes(request: NodeChatRequest):
    """
    Chat with the node generation agent to create nodes based on conversation.
    
    Args:
        request: Chat request with messages
        
    Returns:
        Chat response with generated nodes
    """
    if not _node_gen_client or not _node_gen_agent_config:
        raise HTTPException(status_code=503, detail="Node generation agent not initialized")
    
    try:
        # Convert messages to the format expected by Anthropic
        anthropic_messages = []
        for msg in request.messages:
            anthropic_messages.append({"role": msg.role, "content": msg.content})
        
        # Generate nodes using Anthropic with agent config
        generated_nodes = generate_nodes_from_conversation(_node_gen_client, _node_gen_agent_config, anthropic_messages)
        
        # Create empty files for any new nodes
        if generated_nodes:
            create_empty_files_for_metadata()
        
        # Create response message
        assistant_message = "I've analyzed your conversation and generated appropriate nodes for your canvas."
        if generated_nodes:
            assistant_message += f" I've created {len(generated_nodes)} nodes to help you build what you described."
        
        return NodeChatResponse(
            message=assistant_message,
            generated_nodes=generated_nodes
        )
        
    except Exception as e:
        print(f"Error processing chat: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

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


@app.post("/run-app")
async def launch_full_application():
    """Trigger the run_app.sh helper script to start backend and frontend services."""
    global RUN_APP_PROCESS, RUN_APP_THREAD

    script_path = BACKEND_ROOT.parent / "scripts" / "run_app.sh"
    if not script_path.exists():
        canvas_script = CANVAS_DIR / "scripts" / "run_app.sh"
        if canvas_script.exists():
            script_path = canvas_script
        else:
            raise HTTPException(status_code=404, detail="Startup script not found. Please ensure scripts/run_app.sh exists.")

    with RUN_APP_LOCK:
        if RUN_APP_PROCESS and RUN_APP_PROCESS.poll() is None:
            return {"success": True, "message": "Application launcher already running."}

        script_path_str = script_path.as_posix()

        try:
            RUN_APP_PROCESS = subprocess.Popen(
                ["bash", script_path_str],
                cwd=str(BACKEND_ROOT.parent),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
        except FileNotFoundError as exc:
            RUN_APP_PROCESS = None
            raise HTTPException(status_code=500, detail="bash executable not found on server") from exc
        except Exception as exc:
            RUN_APP_PROCESS = None
            raise HTTPException(status_code=500, detail=f"Failed to launch startup script: {exc}") from exc

        output_logger.write_output("Launching local app via scripts/run_app.sh ...", "INFO")

        def stream_output(process: subprocess.Popen):
            global RUN_APP_PROCESS, RUN_APP_THREAD
            try:
                if process.stdout:
                    for line in iter(process.stdout.readline, ""):
                        if not line:
                            break
                        output_logger.write_output(line.rstrip(), "INFO")
            finally:
                return_code = process.wait()
                output_logger.write_output(f"run_app.sh exited with code {return_code}", "INFO")
                if process.stdout:
                    process.stdout.close()
                with RUN_APP_LOCK:
                    RUN_APP_PROCESS = None
                    RUN_APP_THREAD = None

        RUN_APP_THREAD = threading.Thread(target=stream_output, args=(RUN_APP_PROCESS,), daemon=True)
        RUN_APP_THREAD.start()

    return {"success": True, "message": "Application launch script started."}


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




@app.post("/terminal/execute-stream")
async def execute_terminal_command_stream(cmd: TerminalCommand):
    """
    Execute terminal command with streaming output.
    
    Returns Server-Sent Events (SSE) for real-time output.
    """
    from fastapi.responses import StreamingResponse
    import asyncio
    import subprocess
    
    async def stream_output():
        try:
            workspace_info = workspace_manager.ensure_active_workspace(cmd.command)
            if not workspace_info["success"]:
                yield f"data: {json.dumps({'error': workspace_info['error']})}\n\n"
                return
            
            workspace_path = workspace_info["workspace"]
            print(f"DEBUG: Executing command '{cmd.command}' in workspace: {workspace_path}")
            
            # Handle git clone specially - run in git directory
            if cmd.command.startswith("git clone"):
                # Extract repo name from clone command
                parts = cmd.command.split()
                if len(parts) >= 3:
                    repo_url = parts[-1]  # Last part is the URL
                    repo_name = repo_url.split('/')[-1].replace('.git', '')
                    
                    # Run git clone in the git directory
                    git_dir = workspace_manager.git_dir
                    print(f"DEBUG: Running git clone in git directory: {git_dir}")
                    
                    # Create a new process for git clone in git directory
                    clone_process = subprocess.Popen(
                        cmd.command,
                        shell=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        bufsize=1,
                        cwd=git_dir
                    )
                    
                    # Stream git clone output
                    for line in iter(clone_process.stdout.readline, ''):
                        if line:
                            print(f"DEBUG: Git clone output: {repr(line)}")
                            yield f"data: {json.dumps({'output': line})}\n\n"
                            await asyncio.sleep(0.01)
                    
                    clone_process.wait()
                    print(f"DEBUG: Git clone finished with return code: {clone_process.returncode}")
                    
                    # Auto-set as active workspace after successful clone
                    if clone_process.returncode == 0:
                        result = workspace_manager.set_active_workspace(repo_name)
                        if result["success"]:
                            print(f"DEBUG: Auto-switched to workspace: {result['workspace']}")
                            message = f"\nSwitched to workspace: {repo_name}\n"
                            yield f"data: {json.dumps({'output': message})}\n\n"
                        else:
                            print(f"DEBUG: Failed to switch workspace: {result['error']}")
                            message = f"\nWarning: Could not switch to workspace {repo_name}: {result['error']}\n"
                            yield f"data: {json.dumps({'output': message})}\n\n"
                    else:
                        message = f"\nGit clone failed with return code: {clone_process.returncode}\n"
                        yield f"data: {json.dumps({'output': message})}\n\n"
                
                yield f"data: {json.dumps({'done': True, 'return_code': clone_process.returncode})}\n\n"
            else:
                # Run regular command and stream output
                process = subprocess.Popen(
                    cmd.command,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    cwd=workspace_path
                )
                
                print(f"DEBUG: Process started with PID: {process.pid}")
                
                # Stream output line by line
                for line in iter(process.stdout.readline, ''):
                    if line:
                        print(f"DEBUG: Yielding line: {repr(line)}")
                        yield f"data: {json.dumps({'output': line})}\n\n"
                        await asyncio.sleep(0.01)  # Small delay to prevent blocking
                
                # Send completion status
                process.wait()
                print(f"DEBUG: Process finished with return code: {process.returncode}")
                yield f"data: {json.dumps({'done': True, 'return_code': process.returncode})}\n\n"
            
        except Exception as e:
            print(f"DEBUG: Error in stream_output: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(stream_output(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
