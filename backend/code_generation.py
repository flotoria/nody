"""
Letta agent integration for AI-powered code generation.
"""
import os
import json
from typing import Dict, Any, Optional, List

from fastapi import HTTPException

from config import LETTA_API_KEY, LETTA_BASE_URL, LETTA_METADATA_SYSTEM_PROMPT, EDGES_FILE, CANVAS_DIR
from models import FileNode
from agents.file_system_agent import create_file_system_agent
from utils import extract_structured_payload, sanitize_plan, position_for_index, infer_file_type_from_name
from database import file_db, output_logger


class CodeGenerationService:
    """Handles AI-powered code generation using Letta agent."""
    
    def __init__(self):
        self.client = None
        self.agent = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize the Letta agent."""
        if self._initialized:
            return
        
        try:
            self.client, self.agent = create_file_system_agent()
            print(f"Letta agent initialized with ID: {self.agent.id}")
            self._initialized = True
        except Exception as e:
            print(f"Failed to initialize Letta agent: {e}")
            print("Make sure you have:")
            print("1. Set LETTA_API_KEY environment variable for Letta Cloud, OR")
            print("2. Started a self-hosted Letta server and set LETTA_BASE_URL")
            raise HTTPException(status_code=503, detail="Letta agent initialization failed")
    
    def is_initialized(self) -> bool:
        """Check if the agent is initialized."""
        return self._initialized and self.client is not None and self.agent is not None
    
    def save_edges(self, edges: List[Dict[str, Any]]):
        """Persist edge relationships to disk."""
        try:
            EDGES_FILE.write_text(json.dumps({"edges": edges}, indent=2, ensure_ascii=False), encoding="utf-8")
        except OSError as exc:
            print(f"Error saving edges: {exc}")
    
    async def plan_workspace_with_letta(self, project_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Request the Letta agent to design file and edge metadata for the canvas."""
        if not self.is_initialized():
            raise HTTPException(status_code=503, detail="Letta agent not initialized")

        try:
            response = self.client.agents.messages.create(
                agent_id=self.agent.id,
                messages=[
                    {"role": "system", "content": LETTA_METADATA_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": json.dumps(
                            {"project_spec": project_spec},
                            indent=2,
                            ensure_ascii=False
                        ),
                    },
                ],
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to contact Letta agent: {exc}") from exc

        for message in response.messages:
            if message.message_type == "assistant_message" and message.content:
                try:
                    plan_data = extract_structured_payload(message.content)
                    return sanitize_plan(plan_data, project_spec)
                except HTTPException as parse_error:
                    print(f"Letta metadata parse error: {parse_error.detail}")
                    from utils import fallback_metadata_plan
                    return fallback_metadata_plan(project_spec)

        from utils import fallback_metadata_plan
        return fallback_metadata_plan(project_spec)
    
    async def prepare_project_workspace(self, project_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Transform the saved project spec into canvas metadata and placeholder node files."""
        plan = await self.plan_workspace_with_letta(project_spec)
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

        # Clear existing node files
        file_db.files_db.clear()

        for index, file_entry in enumerate(files_plan):
            if not isinstance(file_entry, dict):
                continue

            file_name = file_entry.get("file_name") or file_entry.get("path")
            if not file_name:
                continue
            file_name = file_name.strip()
            if not file_name:
                continue
            if "." not in os.path.basename(file_name):
                file_name = f"{file_name}.txt"
            normalized_path = os.path.normpath(file_name)
            if normalized_path.startswith(".."):
                continue
            file_name = normalized_path.replace("\\", "/")

            node_id = file_entry.get("id") or file_name
            from utils import slugify
            node_id = slugify(str(node_id))
            label = file_entry.get("label") or os.path.basename(file_name)
            description = file_entry.get("description") or project_spec.get("summary", "")
            x, y = position_for_index(index)

            metadata_payload[node_id] = {
                "id": node_id,
                "type": "file",
                "description": description,
                "x": x,
                "y": y,
                "fileName": file_name,
            }

            file_path = CANVAS_DIR / file_name
            file_path.parent.mkdir(parents=True, exist_ok=True)
            if not file_path.exists():
                file_path.write_text("", encoding="utf-8")

            file_db.files_db[node_id] = FileNode(
                id=node_id,
                label=label,
                x=x,
                y=y,
                status="idle",
                filePath=file_name,
                fileType=infer_file_type_from_name(file_name),
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

        file_db.save_metadata(metadata_payload)
        self.save_edges(valid_edges)

        return {
            "message": "Project workspace prepared",
            "files_created": len(created_files),
            "metadata_nodes": len(metadata_payload),
            "edges_created": len(valid_edges),
            "files": created_files,
            "edges": valid_edges,
        }
    
    async def generate_file_code(self, file_id: str) -> Dict[str, Any]:
        """Generate code for a specific file based on its description in metadata."""
        if not self.is_initialized():
            raise HTTPException(status_code=503, detail="Letta agent not initialized")
        
        try:
            # Load metadata
            metadata = file_db.load_metadata()
            
            if file_id not in metadata:
                raise HTTPException(status_code=404, detail="File node not found in metadata")
            
            node_data = metadata[file_id]
            if node_data.get("type") != "file":
                raise HTTPException(status_code=400, detail="Node is not a file type")
            
            description = node_data.get("description", "")
            file_name = node_data.get("fileName", f"file_{file_id}")
            
            if not description:
                raise HTTPException(status_code=400, detail="No description found for this file node")
            
            output_logger.write_output(f"🔄 Generating {file_name}...", "INFO")
            output_logger.write_output(f"   Description: {description}", "INFO")
            
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
            response = self.client.agents.messages.create(
                agent_id=self.agent.id,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Extract the generated code from the response
            generated_code = ""
            for msg in response.messages:
                if msg.message_type == "assistant_message" and msg.content:
                    generated_code = msg.content
                    break
            
            if not generated_code:
                output_logger.write_output(f"❌ Failed to generate code for {file_name}", "ERROR")
                raise HTTPException(status_code=500, detail="Failed to generate code")
            
            # Write the generated code to the file
            file_path = CANVAS_DIR / file_name
            file_path.write_text(generated_code, encoding='utf-8')
            
            # Update the node file content in files_db
            if file_id in file_db.files_db:
                file_db.files_db[file_id].content = generated_code
            
            output_logger.write_output(f"✅ Generated {file_name} ({len(generated_code)} chars)", "SUCCESS")
            
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
            output_logger.write_output(f"❌ ERROR generating {file_id}: {str(e)}", "ERROR")
            raise HTTPException(status_code=500, detail=f"Error generating code: {str(e)}")
    
    async def run_project(self) -> Dict[str, Any]:
        """Run the project by generating code for all node files based on metadata."""
        if not self.is_initialized():
            raise HTTPException(status_code=503, detail="Letta agent not initialized")
        
        try:
            # Clear previous output and start fresh
            output_logger.clear_output()
            
            # Load metadata
            metadata = file_db.load_metadata()
            
            if not metadata:
                output_logger.write_output("❌ No metadata found", "ERROR")
                return {"message": "No metadata found", "generated_files": [], "progress": []}
            
            generated_files = []
            total_files = sum(1 for node_data in metadata.values() if node_data.get("type") == "file")
            
            if total_files == 0:
                output_logger.write_output("❌ No node file nodes found in metadata", "ERROR")
                return {"message": "No node file nodes found", "generated_files": [], "progress": []}
            
            output_logger.write_output("🚀 Starting project generation...", "INFO")
            output_logger.write_output(f"📋 Found {len(metadata)} nodes in metadata", "INFO")
            output_logger.write_output(f"📁 Processing {total_files} node files...", "INFO")
            
            # Process each file node in metadata
            for i, (node_id, node_data) in enumerate(metadata.items(), 1):
                if node_data.get("type") == "file":
                    description = node_data.get("description", "")
                    file_name = node_data.get("fileName", f"file_{node_id}")
                    
                    if not description:
                        output_logger.write_output(f"⏭️  [{i}/{total_files}] Skipping {file_name} (no description)", "INFO")
                        continue
                    
                    output_logger.write_output(f"🔄 [{i}/{total_files}] Generating {file_name}...", "INFO")
                    output_logger.write_output(f"   Description: {description}", "INFO")
                    
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
                    response = self.client.agents.messages.create(
                        agent_id=self.agent.id,
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
                        file_path = CANVAS_DIR / file_name
                        file_path.write_text(generated_code, encoding='utf-8')
                        
                        # Update the node file content in files_db
                        if node_id in file_db.files_db:
                            file_db.files_db[node_id].content = generated_code
                        
                        output_logger.write_output(f"✅ [{i}/{total_files}] Generated {file_name} ({len(generated_code)} chars)", "SUCCESS")
                        
                        generated_files.append({
                            "node_id": node_id,
                            "file_name": file_name,
                            "description": description,
                            "code_length": len(generated_code)
                        })
                    else:
                        output_logger.write_output(f"❌ [{i}/{total_files}] Failed to generate code for {file_name}", "ERROR")
            
            output_logger.write_output(f"🎉 Generation complete!", "SUCCESS")
            output_logger.write_output(f"📊 Generated {len(generated_files)} node files successfully", "SUCCESS")
            
            return {
                "message": f"Generated code for {len(generated_files)} node files",
                "generated_files": generated_files,
                "total_processed": len(generated_files)
            }
            
        except Exception as e:
            output_logger.write_output(f"❌ ERROR: {str(e)}", "ERROR")
            return {
                "message": f"Error generating code: {str(e)}",
                "generated_files": [],
                "total_processed": 0
            }
    
    async def chat_with_agent(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Send a message to the Letta agent."""
        if not self.is_initialized():
            raise HTTPException(status_code=503, detail="Letta agent not initialized")
        
        try:
            # Convert messages to the format expected by Letta
            letta_messages = [
                {"role": msg["role"], "content": msg["content"]}
                for msg in messages
            ]
            
            # Send message to agent
            response = self.client.agents.messages.create(
                agent_id=self.agent.id,
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
            
            return {
                "agent_id": self.agent.id,
                "messages": response_messages
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")
    
    def get_agent_info(self) -> Dict[str, Any]:
        """Get information about the Letta agent."""
        if not self.is_initialized():
            raise HTTPException(status_code=503, detail="Letta agent not initialized")
        
        return {
            "agent_id": self.agent.id,
            "status": "active",
            "tools_count": len(self.agent.tools) if hasattr(self.agent, 'tools') else 0
        }


# Global instance
code_generation_service = CodeGenerationService()
