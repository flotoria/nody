from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
from datetime import datetime
from dotenv import load_dotenv
from letta_client import Letta
from agents import create_file_system_agent, create_node_generation_agent, generate_nodes_from_conversation

# Load environment variables
load_dotenv()

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

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

class ChatResponse(BaseModel):
    message: str
    generated_nodes: Optional[List[dict]] = None

# In-memory storage for demo (replace with database later)
files_db = {}

# Agent setup - Letta for file system, Anthropic for node generation
_client = None
_agent = None
_node_gen_client = None
_node_gen_agent_config = None

# Initialize both Letta and Anthropic agents on startup
@app.on_event("startup")
async def startup_event():
    """Initialize both Letta (file system) and Anthropic (node generation) agents on startup."""
    global _client, _agent, _node_gen_client, _node_gen_agent_config
    print("=" * 60)
    print("Starting Nody Backend with Letta (File System) + Anthropic (Node Generation)...")
    print("=" * 60)
    
    try:
        # Initialize file system agent (Letta)
        print("Initializing file system agent (Letta)...")
        _client, _agent = create_file_system_agent()
        print(f"✓ File system agent initialized with ID: {_agent.id}")
        
        # Initialize node generation agent (Anthropic)
        print("Initializing node generation agent (Anthropic)...")
        _node_gen_client, _node_gen_agent_config = create_node_generation_agent()
        print("✓ Node generation agent initialized")
        print("=" * 60)
        print("All agents initialized successfully!")
        print("=" * 60)
    except Exception as e:
        print(f"✗ Failed to initialize agents: {e}")
        import traceback
        traceback.print_exc()
        print("Make sure you have:")
        print("1. Set LETTA_API_KEY environment variable for Letta Cloud, OR")
        print("2. Started a self-hosted Letta server and set LETTA_BASE_URL")
        print("3. Set ANTHROPIC_API_KEY environment variable")

# Ensure canvas/files directory exists
CANVAS_DIR = os.path.join(os.path.dirname(__file__), "..", "canvas", "files")
os.makedirs(CANVAS_DIR, exist_ok=True)

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
METADATA_FILE = os.path.join(os.path.dirname(__file__), "..", "canvas", "metadata.json")

# Output file for real-time progress
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "canvas", "output.json")

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

@app.get("/")
async def root():
    return {"message": "Nody VDE Backend API"}

@app.get("/files", response_model=List[FileNode])
async def get_files():
    """Get all nodes from metadata (not just file nodes)"""
    metadata = load_metadata()
    nodes = []
    
    for node_id, node_meta in metadata.items():
        # Use fileName as label if available, otherwise use node_id
        label = node_meta.get("fileName") or node_id
        
        # Create a FileNode for each metadata entry
        file_node = FileNode(
            id=node_id,
            label=label,
            type=node_meta.get("type", "process"),
            filePath=node_meta.get("fileName"),
            fileType=get_file_type_from_description(node_meta.get("description", "")),
            content="",  # Content will be loaded separately if needed
            x=node_meta.get("x", 0),
            y=node_meta.get("y", 0),
            status="idle",
            isExpanded=False,
            isModified=False
        )
        nodes.append(file_node)
    
    return nodes

def get_file_type_from_description(description: str) -> str:
    """Extract file type from description"""
    if "python" in description.lower() or ".py" in description:
        return "python"
    elif "javascript" in description.lower() or ".js" in description:
        return "javascript"
    elif "typescript" in description.lower() or ".ts" in description:
        return "typescript"
    elif "json" in description.lower() or ".json" in description:
        return "json"
    elif "html" in description.lower() or ".html" in description:
        return "html"
    elif "css" in description.lower() or ".css" in description:
        return "css"
    elif "markdown" in description.lower() or ".md" in description:
        return "markdown"
    else:
        return "text"

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

# Agent endpoints - both Letta and Anthropic
@app.get("/letta/health")
async def letta_health():
    """Health check for Letta file system agent"""
    return {
        "status": "healthy" if _agent else "not_initialized",
        "agent_id": _agent.id if _agent else None,
        "agent_type": "file_system"
    }

@app.get("/anthropic/health")
async def anthropic_health():
    """Health check for Anthropic node generation agent"""
    return {
        "status": "healthy" if _node_gen_client else "not_initialized",
        "anthropic_client": "initialized" if _node_gen_client else "not_initialized",
        "agent_type": "node_generation"
    }

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat endpoint that generates nodes based on conversation history.
    
    Args:
        request: Chat request with conversation history
        
    Returns:
        Chat response with AI message and generated nodes
    """
    if not _node_gen_client or not _node_gen_agent_config:
        print(f"Node generation agent not initialized. Client: {_node_gen_client}, Config: {_node_gen_agent_config}")
        raise HTTPException(status_code=503, detail="Node generation agent not initialized")
    
    try:
        print(f"Processing chat request with {len(request.messages)} messages")
        
        # Convert messages to the format expected by Anthropic
        anthropic_messages = []
        for msg in request.messages:
            anthropic_messages.append({"role": msg.role, "content": msg.content})
        
        print(f"Sending {len(anthropic_messages)} messages to Anthropic")
        
        # Generate nodes using Anthropic with agent config
        generated_nodes = generate_nodes_from_conversation(_node_gen_client, _node_gen_agent_config, anthropic_messages)
        
        print(f"Generated nodes: {generated_nodes}")
        
        # Create a simple response message
        assistant_message = "I've analyzed your conversation and generated appropriate nodes for your canvas."
        if generated_nodes:
            assistant_message += f" I've created {len(generated_nodes)} nodes to help you build what you described."
        
        return ChatResponse(
            message=assistant_message,
            generated_nodes=generated_nodes
        )
        
    except Exception as e:
        print(f"Error processing chat: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
