"""
Database and node system operations for managing nodes and metadata.
"""
import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

from config import CANVAS_DIR, METADATA_FILE, OUTPUT_FILE, MAX_OUTPUT_MESSAGES
from models import FileNode, NodeMetadata


class FileDatabase:
    """Manages node files and metadata storage."""
    
    def __init__(self):
        self.files_db: Dict[str, FileNode] = {}
        self._load_existing_files()
    
    def _load_existing_files(self):
        """Load existing node files from filesystem and metadata."""
        metadata = self.load_metadata()
        
        for node_id, node_meta in metadata.items():
            if node_meta.get("type") == "file":
                # Use the fileName from metadata to get the correct file path
                file_name = node_meta.get("fileName")
                if not file_name:
                    print(f"No fileName found for node {node_id}, skipping")
                    continue
                
                # Construct the full file path
                file_path = CANVAS_DIR / file_name
                
                if file_path.exists():
                    actual_file_path = file_path
                else:
                    print(f"File not found: {file_path}")
                    continue
                
                if actual_file_path and actual_file_path.exists():
                    # Read file content
                    try:
                        content = actual_file_path.read_text(encoding='utf-8')
                    except:
                        content = ""
                    
                    # Determine file type from extension
                    from utils import infer_file_type_from_name
                    file_type = infer_file_type_from_name(actual_file_path.name)
                    
                    # Create FileNode object
                    file_node = FileNode(
                        id=node_id,
                        label=actual_file_path.name,
                        type="file",
                        filePath=file_name,  # Use the fileName from metadata
                        fileType=file_type,
                        content=content,
                        x=node_meta.get("x", 0),
                        y=node_meta.get("y", 0),
                        status="idle",
                        isExpanded=False,
                        isModified=False
                    )
                    
                    self.files_db[node_id] = file_node
                    print(f"Loaded file: {node_id} -> {actual_file_path}")
    
    def load_metadata(self) -> Dict[str, Any]:
        """Load metadata from JSON file."""
        if METADATA_FILE.exists():
            try:
                return json.loads(METADATA_FILE.read_text(encoding='utf-8'))
            except (json.JSONDecodeError, IOError):
                return {}
        return {}
    
    def save_metadata(self, metadata: Dict[str, Any]):
        """Save metadata to JSON file."""
        try:
            METADATA_FILE.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding='utf-8')
        except IOError as e:
            print(f"Error saving metadata: {e}")
    
    def update_node_metadata(self, node_id: str, node_type: str, description: str, x: float, y: float):
        """Update metadata for a specific node."""
        metadata = self.load_metadata()
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
        self.save_metadata(metadata)
    
    def remove_node_metadata(self, node_id: str):
        """Remove metadata for a specific node."""
        metadata = self.load_metadata()
        if node_id in metadata:
            del metadata[node_id]
            self.save_metadata(metadata)
    
    def get_all_files(self) -> List[FileNode]:
        """Get all file nodes."""
        return list(self.files_db.values())
    
    def get_file(self, file_id: str) -> Optional[FileNode]:
        """Get a specific file node."""
        return self.files_db.get(file_id)
    
    def create_file(self, file_create_data: Dict[str, Any]) -> FileNode:
        """Create a new file node."""
        # Check for duplicate file name
        for existing_file in self.files_db.values():
            if existing_file.filePath == file_create_data["filePath"]:
                raise ValueError(f"File with name '{file_create_data['filePath']}' already exists")
        
        file_id = str(len(self.files_db) + 1)
        
        new_file = FileNode(
            id=file_id,
            label=os.path.basename(file_create_data["filePath"]),
            x=100,
            y=100,
            filePath=file_create_data["filePath"],
            fileType=file_create_data["fileType"],
            content=file_create_data.get("content", "")
        )
        
        self.files_db[file_id] = new_file
        
        # Create actual node file on filesystem
        file_path = CANVAS_DIR / file_create_data["filePath"]
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(file_create_data.get("content", ""), encoding='utf-8')
        
        # Update metadata with file name
        final_description = file_create_data.get("description", f"File: {file_create_data['filePath']} ({file_create_data['fileType']})")
        self.update_node_metadata(file_id, "file", final_description, new_file.x, new_file.y)
        
        # Also store the file name in metadata for easy access
        metadata = self.load_metadata()
        if file_id in metadata:
            metadata[file_id]["fileName"] = file_create_data["filePath"]
            self.save_metadata(metadata)
        
        return new_file
    
    def update_file_content(self, file_id: str, content: str):
        """Update file content."""
        if file_id not in self.files_db:
            raise ValueError("File not found")
        
        self.files_db[file_id].content = content
        self.files_db[file_id].isModified = False
        
        # Write to actual file
        file_path = CANVAS_DIR / self.files_db[file_id].filePath
        file_path.write_text(content, encoding='utf-8')
    
    def update_file_position(self, file_id: str, x: float, y: float):
        """Update file node position."""
        if file_id not in self.files_db:
            raise ValueError("File not found")
        
        self.files_db[file_id].x = x
        self.files_db[file_id].y = y
        
        # Update metadata position
        node = self.files_db[file_id]
        # Preserve existing description instead of overriding it
        existing_metadata = self.load_metadata()
        existing_description = existing_metadata.get(file_id, {}).get("description", f"File: {node.filePath} ({node.fileType})")
        self.update_node_metadata(file_id, "file", existing_description, x, y)
    
    def update_file_description(self, file_id: str, description: str):
        """Update file node description."""
        if file_id not in self.files_db:
            raise ValueError("File not found")
        
        # Update metadata
        node = self.files_db[file_id]
        self.update_node_metadata(file_id, "file", description, node.x, node.y)
    
    def delete_file(self, file_id: str):
        """Delete a file node."""
        if file_id not in self.files_db:
            raise ValueError("File not found")
        
        # Remove node file from filesystem
        file_path = CANVAS_DIR / self.files_db[file_id].filePath
        if file_path.exists():
            file_path.unlink()
        
        # Remove from metadata
        self.remove_node_metadata(file_id)
        
        del self.files_db[file_id]


class OutputLogger:
    """Manages real-time output messages."""
    
    @staticmethod
    def write_output(message: str, level: str = "INFO"):
        """Write a message to the output file for real-time progress."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        output_entry = {
            "timestamp": timestamp,
            "level": level,
            "message": message
        }
        
        # Load existing output or create new
        if OUTPUT_FILE.exists():
            try:
                output_data = json.loads(OUTPUT_FILE.read_text(encoding='utf-8'))
            except (json.JSONDecodeError, IOError):
                output_data = {"messages": []}
        else:
            output_data = {"messages": []}
        
        # Add new message
        output_data["messages"].append(output_entry)
        
        # Keep only last MAX_OUTPUT_MESSAGES messages to prevent file from growing too large
        if len(output_data["messages"]) > MAX_OUTPUT_MESSAGES:
            output_data["messages"] = output_data["messages"][-MAX_OUTPUT_MESSAGES:]
        
        # Write back to file
        try:
            OUTPUT_FILE.write_text(json.dumps(output_data, indent=2, ensure_ascii=False), encoding='utf-8')
        except IOError as e:
            print(f"Error writing output: {e}")
    
    @staticmethod
    def clear_output():
        """Clear the output file."""
        try:
            OUTPUT_FILE.write_text(json.dumps({"messages": []}, indent=2, ensure_ascii=False), encoding='utf-8')
        except IOError as e:
            print(f"Error clearing output: {e}")
    
    @staticmethod
    def get_output() -> Dict[str, Any]:
        """Get current output messages."""
        if OUTPUT_FILE.exists():
            try:
                return json.loads(OUTPUT_FILE.read_text(encoding='utf-8'))
            except (json.JSONDecodeError, IOError):
                return {"messages": []}
        return {"messages": []}


# Global instances
file_db = FileDatabase()
output_logger = OutputLogger()
