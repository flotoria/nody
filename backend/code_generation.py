"""
Anthropic integration for AI-powered code generation.
"""
import os
import json
from pathlib import Path
from typing import Dict, Any, Optional, List

import anthropic
from fastapi import HTTPException

from config import ANTHROPIC_API_KEY, METADATA_SYSTEM_PROMPT, EDGES_FILE, CANVAS_DIR, BACKEND_ROOT
from models import FileNode
from utils import extract_structured_payload, sanitize_plan, position_for_index, infer_file_type_from_name
from database import file_db, output_logger


RUN_APP_SCRIPT_TEMPLATE = """#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"

BACKEND_PID=""
FRONTEND_PID=""
PYTHON_BIN=()

cleanup() {
  local exit_code=$?
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
    wait "${FRONTEND_PID}" 2>/dev/null || true
  fi
  exit "${exit_code}"
}
trap cleanup EXIT INT TERM

if command -v python >/dev/null 2>&1; then
  PYTHON_BIN=(python)
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN=(python3)
elif command -v py >/dev/null 2>&1; then
  PYTHON_BIN=(py -3)
else
  echo "[run_app] error: no Python interpreter found in PATH" >&2
  exit 1
fi

echo "[run_app] starting backend (uvicorn)..."
(
  cd "${BACKEND_DIR}"
  if [[ -f ".venv/bin/activate" ]]; then
    # shellcheck disable=SC1091
    source ".venv/bin/activate"
  elif [[ -f ".venv/Scripts/activate" ]]; then
    # shellcheck disable=SC1091
    source ".venv/Scripts/activate"
  fi
  exec "${PYTHON_BIN[@]}" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
) &
BACKEND_PID=$!

sleep 2

echo "[run_app] starting frontend (Next.js dev server)..."
(
  cd "${FRONTEND_DIR}"
  if command -v pnpm >/dev/null 2>&1 && [[ -f "pnpm-lock.yaml" ]]; then
    exec pnpm dev
  elif command -v yarn >/dev/null 2>&1 && [[ -f "yarn.lock" ]]; then
    exec yarn dev
  else
    exec npm run dev
  fi
) &
FRONTEND_PID=$!

echo "[run_app] backend PID=${BACKEND_PID}, frontend PID=${FRONTEND_PID}"
echo "[run_app] press Ctrl+C to stop both services."

wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
""".strip() + "\n"

ROOT_RUN_APP_PATH = BACKEND_ROOT.parent / "scripts" / "run_app.sh"
CANVAS_RUN_APP_PATH = CANVAS_DIR / "scripts" / "run_app.sh"


class CodeGenerationService:
    """Handles AI-powered code generation using Anthropic."""
    
    def __init__(self):
        self.client = None
        self._initialized = False
    
    async def initialize(self):
        """Initialize the Anthropic client."""
        if self._initialized:
            return
        
        try:
            self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            print("Anthropic client initialized")
            self._initialized = True
        except Exception as e:
            print(f"Failed to initialize Anthropic client: {e}")
            print("Make sure you have set ANTHROPIC_API_KEY environment variable")
            raise HTTPException(status_code=503, detail="Anthropic client initialization failed")
    
    def is_initialized(self) -> bool:
        """Check if the client is initialized."""
        return self._initialized and self.client is not None
    
    def save_edges(self, edges: List[Dict[str, Any]]):
        """Persist edge relationships to disk."""
        try:
            EDGES_FILE.write_text(json.dumps({"edges": edges}, indent=2, ensure_ascii=False), encoding="utf-8")
        except OSError as exc:
            print(f"Error saving edges: {exc}")

    def _materialize_run_app_script(self, node_id: str, description: str, index: int, total_files: int):
        """Create or update the run_app.sh launcher script in both canvas and root scripts directory."""
        script_content = RUN_APP_SCRIPT_TEMPLATE
        for target_path in (CANVAS_RUN_APP_PATH, ROOT_RUN_APP_PATH):
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_text(script_content, encoding="utf-8")
            try:
                os.chmod(target_path, 0o755)
            except OSError:
                pass

        if node_id in file_db.files_db:
            file_db.files_db[node_id].content = script_content

        output_logger.write_output(
            f"✅ [{index}/{total_files}] Generated scripts/run_app.sh launcher",
            "SUCCESS",
        )

        return {
            "node_id": node_id,
            "file_name": "scripts/run_app.sh",
            "description": description,
            "code_length": len(script_content),
        }
    
    async def plan_workspace(self, project_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Request Anthropic to design file and edge metadata for the canvas."""
        if not self.is_initialized():
            raise HTTPException(status_code=503, detail="Anthropic client not initialized")

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=4000,
                system=METADATA_SYSTEM_PROMPT,
                messages=[
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
            
            # Extract the text content from response
            content = ""
            for block in response.content:
                if block.type == "text":
                    content += block.text
            
            try:
                plan_data = extract_structured_payload(content)
                return sanitize_plan(plan_data, project_spec)
            except HTTPException as parse_error:
                print(f"Metadata parse error: {parse_error.detail}")
                from utils import fallback_metadata_plan
                return fallback_metadata_plan(project_spec)

        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to contact Anthropic: {exc}") from exc
    
    async def prepare_project_workspace(self, project_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Transform the saved project spec into canvas metadata and placeholder node files."""
        plan = await self.plan_workspace(project_spec)
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
            raise HTTPException(status_code=503, detail="Anthropic client not initialized")
        
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
            prompt = f"""Generate ONLY the raw code for "{file_name}" based on this description: "{description}"

ABSOLUTELY NO MARKDOWN OR FORMATTING:
- NO markdown code blocks (no triple backticks ```)
- NO "Here is the code:" or similar text
- NO explanations or comments outside the code
- NO markdown headers, bullets, or formatting
- ONLY return the raw, executable code content itself
- NO text before or after the code

Description: {description}
File name: {file_name}

Output ONLY the pure raw code with no formatting or markdown:"""
            
            # Send to Anthropic
            response = self.client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=16000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Extract the generated code from the response
            generated_code = ""
            for block in response.content:
                if block.type == "text":
                    generated_code += block.text
            
            if not generated_code:
                output_logger.write_output(f"❌ Failed to generate code for {file_name}", "ERROR")
                raise HTTPException(status_code=500, detail="Failed to generate code")
            
            # Write the generated code to the file
            file_path = CANVAS_DIR / file_name
            file_path.parent.mkdir(parents=True, exist_ok=True)
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
    
    async def generate_code_for_description(self, description: str, file_name: str) -> str:
        """Generate code content from a description and file name."""
        if not self.is_initialized():
            raise HTTPException(status_code=503, detail="Anthropic client not initialized")
        
        # Create prompt for code generation
        prompt = f"""Generate ONLY the raw code for "{file_name}" based on this description: "{description}"

ABSOLUTELY NO MARKDOWN OR FORMATTING:
- NO markdown code blocks (no triple backticks ```)
- NO "Here is the code:" or similar text
- NO explanations or comments outside the code
- NO markdown headers, bullets, or formatting
- ONLY return the raw, executable code content itself
- NO text before or after the code

Description: {description}
File name: {file_name}

Output ONLY the pure raw code with no formatting or markdown:"""
        
        # Send to Anthropic
        response = self.client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=16000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        # Extract the generated code from the response
        generated_code = ""
        for block in response.content:
            if block.type == "text":
                generated_code += block.text
        
        return generated_code

    async def run_project(self) -> Dict[str, Any]:
        """Run the project by generating code for all node files based on metadata."""
        if not self.is_initialized():
            raise HTTPException(status_code=503, detail="Anthropic client not initialized")

        try:
            output_logger.clear_output()

            metadata = file_db.load_metadata()

            if not metadata:
                output_logger.write_output("No metadata found", "ERROR")
                return {"message": "No metadata found", "generated_files": [], "progress": []}

            generated_files: List[Dict[str, Any]] = []
            total_files = sum(1 for node_data in metadata.values() if node_data.get("type") == "file")

            if total_files == 0:
                output_logger.write_output("No node file nodes found in metadata", "ERROR")
                return {"message": "No node file nodes found", "generated_files": [], "progress": []}

            output_logger.write_output("Starting project generation...", "INFO")
            output_logger.write_output(f"Found {len(metadata)} nodes in metadata", "INFO")
            output_logger.write_output(f"Processing {total_files} node files...", "INFO")

            for i, (node_id, node_data) in enumerate(metadata.items(), 1):
                if node_data.get("type") != "file":
                    continue

                description = node_data.get("description", "")
                file_name = node_data.get("fileName", f"file_{node_id}")

                if not description:
                    output_logger.write_output(f"[{i}/{total_files}] Skipping {file_name} (no description)", "INFO")
                    continue

                normalized_name = file_name.replace('\\', '/')
                if normalized_name == "scripts/run_app.sh":
                    output_logger.write_output(f"[{i}/{total_files}] Creating launcher script {file_name}...", "INFO")
                    launcher_info = self._materialize_run_app_script(node_id, description, i, total_files)
                    generated_files.append(launcher_info)
                    continue

                output_logger.write_output(f"[{i}/{total_files}] Generating {file_name}...", "INFO")
                output_logger.write_output(f"   Description: {description}", "INFO")

                prompt = f"""Generate ONLY the raw code for "{file_name}" based on this description: "{description}"

ABSOLUTELY NO MARKDOWN OR FORMATTING:
- NO markdown code blocks (no triple backticks ```)
- NO "Here is the code:" or similar text
- NO explanations or comments outside the code
- NO markdown headers, bullets, or formatting
- ONLY return the raw, executable code content itself
- NO text before or after the code

Description: {description}
File name: {file_name}

Output ONLY the pure raw code with no formatting or markdown:"""

                response = self.client.messages.create(
                    model="claude-sonnet-4-5-20250929",
                    max_tokens=16000,
                    messages=[{"role": "user", "content": prompt}]
                )

                generated_code = ""
                for block in response.content:
                    if block.type == "text":
                        generated_code += block.text

                if generated_code:
                    file_path = CANVAS_DIR / file_name
                    file_path.parent.mkdir(parents=True, exist_ok=True)
                    file_path.write_text(generated_code, encoding="utf-8")

                    if node_id in file_db.files_db:
                        file_db.files_db[node_id].content = generated_code

                    output_logger.write_output(
                        f"[{i}/{total_files}] Generated {file_name} ({len(generated_code)} chars)",
                        "SUCCESS",
                    )

                    generated_files.append({
                        "node_id": node_id,
                        "file_name": file_name,
                        "description": description,
                        "code_length": len(generated_code)
                    })
                else:
                    output_logger.write_output(
                        f"[{i}/{total_files}] Failed to generate code for {file_name}",
                        "ERROR",
                    )

            output_logger.write_output("Generation complete!", "SUCCESS")
            output_logger.write_output(
                f"Generated {len(generated_files)} node files successfully",
                "SUCCESS",
            )

            return {
                "message": f"Generated code for {len(generated_files)} node files",
                "generated_files": generated_files,
                "total_processed": len(generated_files)
            }

        except Exception as e:
            output_logger.write_output(f"Error generating project: {str(e)}", "ERROR")
            return {
                "message": f"Error generating code: {str(e)}",
                "generated_files": [],
                "total_processed": 0
            }

    async def generate_fastapi_get_endpoint(
        self,
        endpoint_path: str,
        description: str
    ) -> str:
        """Generate a FastAPI GET endpoint code."""
        if not self.is_initialized():
            raise HTTPException(status_code=503, detail="Anthropic client not initialized")
        
        prompt = f"""Generate a FastAPI GET endpoint with the following specifications:

- Endpoint path: {endpoint_path}
- Description: {description}
- Include proper type hints and docstrings
- Follow FastAPI best practices
- Return ONLY the endpoint code, no explanations

Generate ONLY the FastAPI endpoint decorator and function code:"""
        
        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=4000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Extract the generated code
            generated_code = ""
            for block in response.content:
                if block.type == "text":
                    generated_code += block.text
            
            return generated_code.strip()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating GET endpoint: {str(e)}")
    
    async def generate_fastapi_post_endpoint(
        self,
        endpoint_path: str,
        description: str
    ) -> str:
        """Generate a FastAPI POST endpoint code."""
        if not self.is_initialized():
            raise HTTPException(status_code=503, detail="Anthropic client not initialized")
        
        prompt = f"""Generate a FastAPI POST endpoint with the following specifications:

- Endpoint path: {endpoint_path}
- Description: {description}
- Include proper type hints and docstrings
- Follow FastAPI best practices
- Return ONLY the endpoint code, no explanations

Generate ONLY the FastAPI endpoint decorator and function code:"""
        
        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=4000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Extract the generated code
            generated_code = ""
            for block in response.content:
                if block.type == "text":
                    generated_code += block.text
            
            return generated_code.strip()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating POST endpoint: {str(e)}")


# Global instance
code_generation_service = CodeGenerationService()
