"""
Metadata tools for managing metadata.json file.
These tools allow the agent to read and update metadata.json.
"""

import os
import json
from typing import Dict, Any, Optional
from pydantic import BaseModel, ValidationError

# Path to metadata.json - go up one level from backend to root, then into canvas
METADATA_PATH = os.path.join(os.path.dirname(__file__), "..", "canvas", "metadata.json")

# Schema for metadata.json
class NodeMetadataSchema(BaseModel):
    id: str
    type: str
    description: str
    x: float
    y: float
    fileName: Optional[str] = None  # Optional for non-file nodes


def load_metadata() -> Dict[str, Any]:
    """
    Load metadata from metadata.json file.
    
    Returns:
        Dictionary containing metadata for all nodes
    """
    if not os.path.exists(METADATA_PATH):
        return {}
    
    try:
        with open(METADATA_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading metadata: {e}")
        return {}


def save_metadata(metadata: Dict[str, Any]) -> bool:
    """
    Save metadata to metadata.json file.
    
    Args:
        metadata: Dictionary containing metadata for all nodes
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Validate metadata against schema
        for node_id, node_data in metadata.items():
            try:
                NodeMetadataSchema(**node_data)
            except ValidationError as e:
                print(f"Validation error for node {node_id}: {e}")
                return False
        
        # Save to file
        os.makedirs(os.path.dirname(METADATA_PATH), exist_ok=True)
        with open(METADATA_PATH, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        return True
    except Exception as e:
        print(f"Error saving metadata: {e}")
        return False


def update_node_metadata(node_id: str, node_type: str, description: str, x: float, y: float) -> bool:
    """
    Update metadata for a specific node.
    
    Args:
        node_id: Unique identifier for the node
        node_type: Type of node (file, process, etc.)
        description: Description of what the node does
        x: X coordinate on canvas
        y: Y coordinate on canvas
        
    Returns:
        True if successful, False otherwise
    """
    metadata = load_metadata()
    
    metadata[node_id] = {
        "id": node_id,
        "type": node_type,
        "description": description,
        "x": x,
        "y": y
    }
    
    return save_metadata(metadata)


def add_node_to_metadata(node_id: str, node_type: str, description: str, x: float, y: float) -> Dict[str, Any]:
    """
    Add a new node to metadata.json.
    
    Args:
        node_id: Unique identifier for the node
        node_type: Type of node (file, process, etc.)
        description: Description of what the node does
        x: X coordinate on canvas
        y: Y coordinate on canvas
        
    Returns:
        Dictionary with success status and any error message
    """
    try:
        # Validate the node data
        node_data = {
            "id": node_id,
            "type": node_type,
            "description": description,
            "x": x,
            "y": y
        }
        
        # Validate against schema
        NodeMetadataSchema(**node_data)
        
        # Load existing metadata
        metadata = load_metadata()
        
        # Add new node
        metadata[node_id] = node_data
        
        # Save
        if save_metadata(metadata):
            return {"success": True, "message": f"Node {node_id} added to metadata"}
        else:
            return {"success": False, "message": "Failed to save metadata"}
            
    except ValidationError as e:
        return {"success": False, "message": f"Validation error: {str(e)}"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}


def get_metadata() -> Dict[str, Any]:
    """
    Get the current metadata.
    
    Returns:
        Dictionary containing metadata for all nodes
    """
    return load_metadata()


def add_nodes_to_metadata(nodes: list) -> Dict[str, Any]:
    """
    Add multiple nodes to metadata.json at once.
    
    Args:
        nodes: List of node dictionaries with keys: id, type, description, x, y, fileName (optional)
        
    Returns:
        Dictionary with success status and any error message
    """
    try:
        # Load existing metadata
        metadata = load_metadata()
        
        # Add each node
        for node in nodes:
            node_id = node.get("id")
            if not node_id:
                return {"success": False, "message": "Each node must have an 'id' field"}
            
            # Create node data with default values
            node_data = {
                "id": node_id,
                "type": node.get("type", "process"),
                "description": node.get("description", ""),
                "x": node.get("x", 100.0),
                "y": node.get("y", 100.0),
            }
            
            # Add fileName if present
            if "fileName" in node:
                node_data["fileName"] = node["fileName"]
            
            # Validate against schema
            try:
                NodeMetadataSchema(**node_data)
            except ValidationError as e:
                return {"success": False, "message": f"Validation error for node {node_id}: {str(e)}"}
            
            # Add to metadata
            metadata[node_id] = node_data
        
        # Save
        if save_metadata(metadata):
            return {"success": True, "message": f"Added {len(nodes)} nodes to metadata"}
        else:
            return {"success": False, "message": "Failed to save metadata"}
            
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

