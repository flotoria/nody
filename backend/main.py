"""
Main FastAPI application for Nody VDE Backend.
"""
import json
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, TYPE_CHECKING
import os
import json
from datetime import datetime
import subprocess
import threading
from dotenv import load_dotenv
from agents import create_node_generation_agent, generate_nodes_from_conversation

from config import API_TITLE, API_VERSION, CORS_ORIGINS, EDGES_FILE, METADATA_FILE, CANVAS_DIR, BACKEND_ROOT, TEMPLATE_TRACKER_FILE, OUTPUT_FILE
from models import (
    FileNode, FileContent, FileCreate, DescriptionUpdate, NodeMetadata,
    OnboardingChatRequest, OnboardingChatResponse, ProjectSpecResponse, PrepareProjectResponse,
    AgentChatRequest, AgentChatResponse, AgentMessage, TerminalCommand,
    FolderNode, FolderCreate, FolderUpdate
)
from database import file_db, output_logger, OutputLogger
from onboarding import onboarding_service
from code_generation import code_generation_service
from workspace import workspace_service, WorkspaceManager

# Initialize workspace manager
workspace_manager = WorkspaceManager()

RUN_APP_PROCESS: Optional[subprocess.Popen] = None
RUN_APP_THREAD: Optional[threading.Thread] = None
RUN_APP_LOCK = threading.Lock()

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
_node_gen_client = None
_node_gen_agent_config = None

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    global _node_gen_client, _node_gen_agent_config
    try:
        # Initialize code generation service
        await code_generation_service.initialize()
        print("Code generation service initialized")
        
        # Initialize node generation agent
        _node_gen_client, _node_gen_agent_config = create_node_generation_agent()
        print("Node generation agent initialized")
        
        print("All services initialized successfully")
    except Exception as e:
        print(f"Failed to initialize services: {e}")
        print("Make sure you have:")
        print("1. Set ANTHROPIC_API_KEY environment variable")


# ==================== FILE OPERATIONS ====================

def create_empty_files_for_metadata():
    """Create empty files for all nodes in metadata that don't have files yet"""
    try:
        metadata = file_db.load_metadata()
        created_files = []
        
        for node_id, node_meta in metadata.items():
            if node_meta.get("type") == "file":
                file_name = node_meta.get("fileName", f"file_{node_id}.py")
                file_path = os.path.join(CANVAS_DIR, file_name)
                
                # Create completely empty file if it doesn't exist
                if not os.path.exists(file_path):
                    os.makedirs(os.path.dirname(file_path), exist_ok=True)
                    # Just create an empty file
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write("")  # Completely empty
                    created_files.append(file_name)
                    print(f"Created empty file: {file_name}")
        
        return created_files
    except Exception as e:
        print(f"Error creating files: {e}")
        return []

async def generate_node_code(node: dict):
    """Generate actual code for a node using AI based on its description"""
    try:
        file_name = node.get("fileName", f"file_{node.get('id')}.py")
        description = node.get("description", "")
        node_id = node.get("id")
        
        # Extract just the filename without any path (to avoid nesting issues)
        base_file_name = os.path.basename(file_name)
        
        # Use the code generation service to generate code
        code_content = await code_generation_service.generate_code_for_description(description, base_file_name)
        
        # Write code to file at the correct location based on its folder
        # Remove leading "nodes/" from file_name if present to avoid canvas/nodes/nodes/
        clean_file_name = file_name
        if file_name.startswith("nodes/"):
            clean_file_name = file_name[len("nodes/"):]
        file_path = os.path.join(CANVAS_DIR, clean_file_name)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code_content)
        
        # Update the in-memory files_db cache with the generated code
        if node_id and node_id in file_db.files_db:
            file_db.files_db[node_id].content = code_content
        
        print(f"Generated code for {file_name}")
    except Exception as e:
        print(f"Error generating code for {node.get('id')}: {e}")


async def generate_edges_for_nodes(generated_nodes: List[dict]):
    """Generate edges between nodes based on their descriptions and relationships."""
    try:
        if not generated_nodes or len(generated_nodes) < 2:
            return
        
        # Load current metadata to get all nodes for context
        metadata = file_db.load_metadata()
        
        # Create a simplified node list with just the essentials for edge generation
        nodes_for_analysis = []
        for node in generated_nodes:
            node_id = node.get("id")
            if node_id and node_id in metadata:
                node_data = metadata[node_id]
                nodes_for_analysis.append({
                    "id": node_id,
                    "fileName": node_data.get("fileName", f"file_{node_id}.py"),
                    "description": node_data.get("description", ""),
                    "type": node_data.get("type", "file")
                })
        
        if len(nodes_for_analysis) < 2:
            return
        
        # Use AI to determine relationships between nodes
        prompt = f"""Given these nodes in a project, determine which nodes should be connected with edges.

Nodes:
{json.dumps(nodes_for_analysis, indent=2)}

Return ONLY a JSON array of edges in this format:
[
  {{"from": "node_id_1", "to": "node_id_2", "type": "depends_on", "description": "brief explanation"}},
  {{"from": "node_id_1", "to": "node_id_3", "type": "calls", "description": "brief explanation"}}
]

Guidelines:
- Only create edges that make logical sense based on the node descriptions
- Use "depends_on" for files that import or require other files
- Use "calls" for files that call functions from other files
- Only connect nodes that actually relate to each other based on their purpose
- Return an empty array [] if no meaningful connections exist
- Do NOT connect all nodes to all other nodes (be selective and thoughtful)
- Focus on the most important dependencies only

Output ONLY the JSON array, no markdown, no explanation:"""
        
        response = code_generation_service.client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        # Extract edges from response
        edges_json = ""
        for block in response.content:
            if block.type == "text":
                edges_json += block.text
        
        # Parse the JSON edges
        try:
            # Clean up any markdown formatting
            edges_json = edges_json.strip()
            if edges_json.startswith("```"):
                edges_json = edges_json.strip("`")
                if "\n" in edges_json:
                    _, edges_json = edges_json.split("\n", 1)
            if edges_json.endswith("```"):
                edges_json = edges_json[:-3]
            
            new_edges = json.loads(edges_json.strip())
            
            if not isinstance(new_edges, list):
                return
            
            # Load existing edges
            edges = []
            if EDGES_FILE.exists():
                with open(EDGES_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    edges = data.get("edges", [])
            
            # Add new edges (avoid duplicates)
            existing_edge_tuples = {(e.get("from"), e.get("to")) for e in edges}
            
            for edge in new_edges:
                if isinstance(edge, dict) and "from" in edge and "to" in edge:
                    edge_tuple = (edge.get("from"), edge.get("to"))
                    if edge_tuple not in existing_edge_tuples:
                        edges.append({
                            "from": edge.get("from"),
                            "to": edge.get("to"),
                            "type": edge.get("type", "depends_on"),
                            "description": edge.get("description", "")
                        })
                        existing_edge_tuples.add(edge_tuple)
            
            # Save edges
            edges_data = {"edges": edges}
            with open(EDGES_FILE, 'w', encoding='utf-8') as f:
                json.dump(edges_data, f, indent=2)
            
            print(f"Generated {len(new_edges)} edges between nodes")
            
        except json.JSONDecodeError as e:
            print(f"Error parsing edges JSON: {e}")
            print(f"Raw response: {edges_json}")
    
    except Exception as e:
        print(f"Error generating edges: {e}")
        import traceback
        traceback.print_exc()


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
            "description": file_create.description,
            "category": file_create.category,
        }
        new_file = file_db.create_file(file_data)
        return new_file
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/files/{file_id}/status")
async def get_file_status(file_id: str):
    """Get the status of a specific file node"""
    file_node = file_db.get_file(file_id)
    if not file_node:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Return a simple status response
    return {
        "status": file_node.status or "idle",
        "running": file_node.status == "running" if file_node.status else False
    }

@app.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """Delete a node file"""
    try:
        file_db.delete_file(file_id)
        return {"message": "File deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/files/{file_id}/run")
async def run_file_stream(file_id: str):
    """Stream file execution output via Server-Sent Events"""
    import subprocess
    import asyncio
    from fastapi.responses import StreamingResponse
    
    file_node = file_db.get_file(file_id)
    if not file_node:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Validate file has required attributes
    if not file_node.filePath:
        raise HTTPException(status_code=400, detail="File path not set")
    
    # Update status to running
    try:
        file_db.update_file_status(file_id, "running")
    except:
        pass  # Ignore if update fails
    
    async def generate():
        process = None
        try:
            # Get the file path
            file_path = CANVAS_DIR / file_node.filePath
            
            # Determine the command based on file type
            if file_node.fileType == "python":
                cmd = ["python", str(file_path)]
            elif file_node.fileType == "javascript":
                cmd = ["node", str(file_path)]
            else:
                cmd = [str(file_path)]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(CANVAS_DIR)
            )
            
            # Stream output
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                
                output = line.decode('utf-8', errors='replace').strip()
                yield f"data: {json.dumps({'output': output, 'done': False})}\n\n"
            
            # Wait for process to complete
            return_code = await process.wait()
            
            # Send completion event
            yield f"data: {json.dumps({'success': return_code == 0, 'return_code': return_code, 'done': True})}\n\n"
            
            # Update status
            try:
                file_db.update_file_status(file_id, "idle")
            except:
                pass
                
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
            try:
                file_db.update_file_status(file_id, "idle")
            except:
                pass
        finally:
            if process:
                try:
                    process.kill()
                except:
                    pass
    
    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/files/{file_id}/stop")
async def stop_file_execution(file_id: str):
    """Stop running file execution"""
    # This is a simple implementation - in production you'd want to track and kill the process
    try:
        file_db.update_file_status(file_id, "idle")
        return {"message": "File execution stopped", "success": True}
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


async def generate_template_output(template_id: str, metadata: dict):
    """Generate realistic console output based on the template type and nodes."""
    import asyncio
    
    output_messages = []
    
    if template_id == "hello-world":
        # Simple Todo Tracker
        output_messages = [
            ("SUCCESS", "Loading template: Simple Todo Tracker"),
            ("INFO", "Initializing project structure..."),
            ("INFO", "Creating file: main.py"),
            ("SUCCESS", "✓ main.py created successfully"),
            ("INFO", "Creating file: todo.py"),
            ("SUCCESS", "✓ todo.py created successfully"),
            ("INFO", "Creating file: storage.py"),
            ("SUCCESS", "✓ storage.py created successfully"),
            ("INFO", "Setting up dependencies..."),
            ("SUCCESS", "✓ Dependencies configured"),
            ("SUCCESS", "Project structure loaded successfully!"),
            ("INFO", "Ready to start building your todo tracker app."),
        ]
    elif template_id == "frontend-web":
        # Personal Portfolio Website
        output_messages = [
            ("SUCCESS", "Loading template: Personal Portfolio Website"),
            ("INFO", "Initializing React project..."),
            ("INFO", "Creating file: frontend/app/page.tsx"),
            ("SUCCESS", "✓ Main page component created"),
            ("INFO", "Creating file: frontend/components/Hero.tsx"),
            ("SUCCESS", "✓ Hero component created"),
            ("INFO", "Creating file: frontend/components/ProjectCard.tsx"),
            ("SUCCESS", "✓ Project card component created"),
            ("INFO", "Creating file: frontend/app/globals.css"),
            ("SUCCESS", "✓ Global styles configured"),
            ("INFO", "Setting up Tailwind CSS..."),
            ("SUCCESS", "✓ Tailwind CSS initialized"),
            ("INFO", "Installing dependencies..."),
            ("SUCCESS", "✓ React, Next.js installed"),
            ("SUCCESS", "Portfolio website structure loaded successfully!"),
            ("INFO", "Ready to customize your portfolio."),
        ]
    elif template_id == "data-pipeline":
        # CSV Data Analyzer
        output_messages = [
            ("SUCCESS", "Loading template: CSV Data Analyzer"),
            ("INFO", "Initializing Python project..."),
            ("INFO", "Creating file: main.py"),
            ("SUCCESS", "✓ Main pipeline script created"),
            ("INFO", "Creating file: csv_reader.py"),
            ("SUCCESS", "✓ CSV reader module created"),
            ("INFO", "Creating file: analyzer.py"),
            ("SUCCESS", "✓ Data analyzer module created"),
            ("INFO", "Creating file: exporter.py"),
            ("SUCCESS", "✓ Data exporter module created"),
            ("INFO", "Installing pandas, numpy..."),
            ("SUCCESS", "✓ Data processing libraries installed"),
            ("INFO", "Setting up data directory..."),
            ("SUCCESS", "✓ Project structure complete"),
            ("SUCCESS", "CSV data analyzer loaded successfully!"),
            ("INFO", "Ready to process CSV files."),
        ]
    elif template_id == "test":
        # Test
        output_messages = [
            ("SUCCESS", "Loading template: Test"),
            ("INFO", "Initializing test project..."),
            ("INFO", "Creating file: test.py"),
            ("SUCCESS", "✓ test.py created successfully"),
            ("SUCCESS", "Test project loaded successfully!"),
        ]
    
    # Stream the output messages with delays to simulate realistic output
    for level, message in output_messages:
        output_logger.write_output(message, level)
        await asyncio.sleep(0.3)  # 300ms delay between messages


@app.post("/canvas/load-template/{template_id}")
async def load_template(template_id: str):
    """Load a template project from dummy/ directory into canvas"""
    try:
        import shutil
        from pathlib import Path
        
        # Define template mapping (template IDs to folder names)
        template_mapping = {
            "hello-world": "simple-todo-tracker",
            "frontend-web": "personal-portfolio-website",
            "data-pipeline": "csv-data-analyzer",
            "test": "test"
        }
        
        if template_id not in template_mapping:
            raise HTTPException(status_code=404, detail=f"Template {template_id} not found")
        
        template_folder_name = template_mapping[template_id]
        # dummy/ is at the root level, not in backend/
        # BACKEND_ROOT is backend/, so we need to go up one level
        dummy_template_path = BACKEND_ROOT.parent / "dummy" / template_folder_name
        
        if not dummy_template_path.exists():
            raise HTTPException(status_code=404, detail=f"Template folder {template_folder_name} not found at {dummy_template_path}")
        
        # Clear the canvas first
        EDGES_FILE.write_text(json.dumps({"edges": []}, indent=2), encoding='utf-8')
        METADATA_FILE.write_text(json.dumps({}, indent=2), encoding='utf-8')
        
        if CANVAS_DIR.exists():
            shutil.rmtree(CANVAS_DIR)
        
        CANVAS_DIR.mkdir(exist_ok=True)
        file_db.files_db.clear()
        output_logger.clear_output()
        
        # Copy metadata.json
        template_metadata = dummy_template_path / "metadata.json"
        if template_metadata.exists():
            shutil.copy(template_metadata, METADATA_FILE)
        
        # Copy edges.json
        template_edges = dummy_template_path / "edges.json"
        if template_edges.exists():
            shutil.copy(template_edges, EDGES_FILE)
        
        # Copy nodes directory
        template_nodes = dummy_template_path / "nodes"
        if template_nodes.exists():
            import shutil
            shutil.copytree(template_nodes, CANVAS_DIR / "nodes")
        
        # Refresh the database from the new metadata
        metadata = file_db.load_metadata()
        file_db.refresh_files_from_metadata(metadata)
        
        # Determine output file path for this template
        template_output_file = dummy_template_path / "output.json"
        
        # Save which template is active and its output path
        # Store the proper template_id and folder info
        template_tracker_data = {
            "template_id": template_id,  # This is the key from template_mapping (e.g., "data-pipeline")
            "output_file": str(template_output_file),
            "template_folder": template_folder_name  # This is the folder name (e.g., "csv-data-analyzer")
        }
        TEMPLATE_TRACKER_FILE.write_text(json.dumps(template_tracker_data), encoding='utf-8')
        print(f"Saved template tracker: {template_tracker_data}")
        
        # Don't generate output on load - only when user clicks Run
        # await generate_template_output(template_id, metadata)
        
        return {"message": f"Template {template_id} loaded successfully"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"Template files not found: {str(e)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error loading template: {str(e)}")


@app.post("/canvas/run-template")
async def run_template():
    """Run the currently active template and stream realistic output"""
    try:
        from pathlib import Path
        
        # Define reverse template mapping (folder names to template IDs)
        folder_to_template_mapping = {
            "simple-todo-tracker": "hello-world",
            "personal-portfolio-website": "frontend-web",
            "csv-data-analyzer": "data-pipeline",
            "test": "test"
        }
        
        # Check if a template is active
        if not TEMPLATE_TRACKER_FILE.exists():
            return {"success": False, "error": "No template is currently loaded. Please load a template first."}
        
        template_data = json.loads(TEMPLATE_TRACKER_FILE.read_text(encoding='utf-8'))
        template_id = template_data.get("template_id")
        template_folder = template_data.get("template_folder")
        template_output_file = template_data.get("output_file")
        
        # If template_id is actually a folder name, convert it to proper template ID
        if template_id in folder_to_template_mapping:
            template_id = folder_to_template_mapping[template_id]
        elif template_folder and template_folder in folder_to_template_mapping:
            template_id = folder_to_template_mapping[template_folder]
        
        if not template_id:
            return {"success": False, "error": "No template is currently loaded. Please load a template first."}
        
        # Get the output file path for this template
        output_file_path = Path(template_output_file) if template_output_file else OUTPUT_FILE
        
        # Set the logger to write to the template's output file
        template_logger = OutputLogger()
        template_logger.set_output_file(output_file_path)
        
        # Clear existing output
        template_logger.clear_output()
        
        # Load metadata to get the current state
        metadata = file_db.load_metadata()
        
        # Generate template-specific execution output
        await generate_template_execution_output(template_id, metadata, template_logger)
        
        return {"success": True, "message": f"Template {template_id} run completed"}
    except FileNotFoundError as e:
        return {"success": False, "error": f"Template output file not found: {str(e)}"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": f"Error running template: {str(e)}"}


async def generate_template_execution_output(template_id: str, metadata: dict, logger: OutputLogger):
    """Generate realistic execution output when running a template."""
    import asyncio
    import random
    
    print(f"DEBUG: generate_template_execution_output called with template_id: {template_id}")
    output_messages = []
    
    if template_id == "hello-world":
        # Simple Todo Tracker - execution output based on actual code
        output_messages = [
            ("INFO", "$ python main.py"),
            ("INFO", "Welcome to Todo Tracker!"),
            ("INFO", "Commands: add <task>, list, remove <index>, quit"),
            ("INFO", ""),
            ("INFO", "> _"),
        ]
    elif template_id == "frontend-web":
        # Personal Portfolio Website - execution output based on Next.js actual behavior
        compile_time = round(random.uniform(1.5, 3.5), 1)
        output_messages = [
            ("INFO", "$ npm run dev"),
            ("INFO", ""),
            ("INFO", "  ▲ Next.js 14.0.0"),
            ("INFO", "  - Local:        http://localhost:3001"),
            ("INFO", "  - Environments: .env.local"),
            ("INFO", ""),
            ("INFO", " ✓ Ready in 124ms"),
            ("INFO", ""),
            ("INFO", " ○ Compiling / ..."),
            ("INFO", " ✓ Compiled / in 251ms"),
            ("SUCCESS", "✓ Portfolio website is running at http://localhost:3001"),
        ]
    elif template_id == "data-pipeline":
        # CSV Data Analyzer - execution output based on actual code
        rows = random.randint(500, 5000)
        cols = random.randint(3, 8)
        min_val1 = round(random.uniform(10, 20), 1)
        max_val1 = round(random.uniform(80, 100), 1)
        mean_val1 = round(random.uniform(40, 60), 1)
        
        output_messages = [
            ("INFO", "$ python main.py"),
            ("INFO", "CSV Data Analyzer"),
            ("INFO", "=" * 50),
            ("INFO", f"Loaded {rows} rows from CSV"),
            ("INFO", ""),
            ("INFO", "Data Summary:"),
            ("INFO", f"Total rows: {rows}"),
            ("INFO", f"Total columns: {cols}"),
            ("INFO", f"Columns: id, name, category, value1, value2"),
            ("INFO", ""),
            ("INFO", "Statistics:"),
            ("INFO", f"value1: min={min_val1}, max={max_val1}, mean={mean_val1}"),
            ("INFO", f"value2: min={round(random.uniform(5, 15), 1)}, max={round(random.uniform(70, 95), 1)}, mean={round(random.uniform(35, 55), 1)}"),
            ("INFO", ""),
            ("INFO", "Analysis complete! Results saved to summary.json and statistics.csv"),
        ]
    elif template_id == "test":
        # Test - execution output based on actual code
        output_messages = [
            ("INFO", "$ python test.py"),
            ("INFO", "asdjioajsoesg"),
        ]
    else:
        # Fallback for unknown templates
        output_messages = [
            ("INFO", "Starting project..."),
            ("SUCCESS", "✓ Project started"),
            ("INFO", "Ready to run!"),
        ]
    
    # Stream the output messages with delays
    for level, message in output_messages:
        logger.write_output(message, level)
        await asyncio.sleep(0.4)  # 400ms delay between messages


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
    """Create a new folder node and corresponding directory in filesystem"""
    try:
        metadata = file_db.load_metadata()
        
        # Generate unique folder ID
        folder_id = f"folder_{len([k for k in metadata.keys() if k.startswith('folder_')]) + 1}"
        
        # Create actual directory in canvas/nodes (CANVAS_DIR is already canvas/nodes)
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
    try:
        # Check if a template is loaded and use its output file
        if TEMPLATE_TRACKER_FILE.exists():
            template_data = json.loads(TEMPLATE_TRACKER_FILE.read_text(encoding='utf-8'))
            template_output_file = template_data.get("output_file")
            
            if template_output_file:
                from pathlib import Path
                output_file_path = Path(template_output_file)
                
                # Create a temporary logger pointing to the template's output file
                template_logger = OutputLogger()
                template_logger.set_output_file(output_file_path)
                return template_logger.get_output()
    except Exception as e:
        print(f"Error getting template output: {e}")
        # Fall through to default behavior
    
    # Default: use the canvas output
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


# ==================== ANTHROPIC AGENT OPERATIONS ====================

@app.get("/anthropic/health")
async def anthropic_health():
    """Health check for Anthropic agent"""
    return {
        "status": "healthy" if code_generation_service.is_initialized() else "not_initialized"
    }


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
        
        # Create files and generate code for any new nodes
        if generated_nodes:
            # First, create empty files for any new nodes
            create_empty_files_for_metadata()
            
            # Then generate code for each newly created node
            metadata = file_db.load_metadata()
            for node in generated_nodes:
                node_id = node.get("id")
                if node_id and node_id in metadata:
                    # Generate code for this node based on its description
                    try:
                        await generate_node_code(metadata[node_id])
                        print(f"Successfully generated code for node {node_id}")
                    except Exception as e:
                        print(f"Error generating code for node {node_id}: {e}")
                        # Continue with other nodes even if one fails
            
            # Generate edges between the newly created nodes
            try:
                await generate_edges_for_nodes(generated_nodes)
                print(f"Successfully generated edges between nodes")
            except Exception as e:
                print(f"Error generating edges between nodes: {e}")
                # Don't fail the whole request if edge generation fails
        
        # Create response message
        assistant_message = "I've analyzed your conversation and generated nodes with code and edges for your canvas."
        if generated_nodes:
            assistant_message += f" I've created {len(generated_nodes)} nodes with generated code and automatic connections to help you build what you described."
        
        return NodeChatResponse(
            message=assistant_message,
            generated_nodes=generated_nodes
        )
        
    except Exception as e:
        print(f"Error processing chat: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")

@app.post("/anthropic/generate-code")
async def generate_code_from_metadata():
    """Generate code for all files based on metadata.json descriptions."""
    try:
        result = await code_generation_service.run_project()
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating code: {str(e)}")


class GenerateFastAPIGetRequest(BaseModel):
    endpoint_path: str
    description: str

class GenerateFastAPIPostRequest(BaseModel):
    endpoint_path: str
    description: str

class EndpointCodeResponse(BaseModel):
    code: str
    endpoint_path: str
    method: str

@app.post("/api/generate-fastapi-get", response_model=EndpointCodeResponse)
async def generate_fastapi_get_endpoint(request: GenerateFastAPIGetRequest):
    """Generate a FastAPI GET endpoint code."""
    try:
        code = await code_generation_service.generate_fastapi_get_endpoint(
            endpoint_path=request.endpoint_path,
            description=request.description
        )
        return EndpointCodeResponse(
            code=code,
            endpoint_path=request.endpoint_path,
            method="GET"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating GET endpoint: {str(e)}")

@app.post("/api/generate-fastapi-post", response_model=EndpointCodeResponse)
async def generate_fastapi_post_endpoint(request: GenerateFastAPIPostRequest):
    """Generate a FastAPI POST endpoint code."""
    try:
        code = await code_generation_service.generate_fastapi_post_endpoint(
            endpoint_path=request.endpoint_path,
            description=request.description
        )
        return EndpointCodeResponse(
            code=code,
            endpoint_path=request.endpoint_path,
            method="POST"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating POST endpoint: {str(e)}")


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
            # Force workspace to be canvas/nodes directory
            canvas_nodes_dir = os.path.join(os.path.dirname(__file__), "..", "canvas", "nodes")
            if os.path.exists(canvas_nodes_dir):
                workspace_manager.active_workspace = os.path.abspath(canvas_nodes_dir)
                print(f"DEBUG: Forced workspace to canvas/nodes: {workspace_manager.active_workspace}")
            else:
                # Fallback to canvas directory
                canvas_dir = os.path.join(os.path.dirname(__file__), "..", "canvas")
                if os.path.exists(canvas_dir):
                    workspace_manager.active_workspace = os.path.abspath(canvas_dir)
                    print(f"DEBUG: Forced workspace to canvas: {workspace_manager.active_workspace}")
            
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
