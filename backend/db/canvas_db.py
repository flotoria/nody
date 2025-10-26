"""
CanvasDB - ChromaDB integration for canvas data storage.

This module provides methods to:
1. Sync data from canvas/ directory to ChromaDB
2. Query and retrieve canvas data from ChromaDB using semantic search
3. Manage nodes, edges, files, messages, and templates in ChromaDB

Collections:
- nodes: Node metadata (id, type, description, x, y, fileName, category)
- edges: Edge/relationship data (from, to, type, description)
- files: File content for semantic search
- messages: Conversation messages
- templates: Template tracking information
"""

import os
import json
from typing import Dict, Any, List, Optional
from pathlib import Path
import chromadb
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import or create the ChromaDB client
try:
    from db.db import client
except ImportError:
    # Fallback if running as script
    CHROMA_API_KEY = os.getenv("CHROMA_API_KEY")
    CHROMA_TENANT = os.getenv("CHROMA_TENANT")
    
    client = chromadb.CloudClient(
        api_key=CHROMA_API_KEY,
        tenant=CHROMA_TENANT,
        database='Nody'
    )


class CanvasDB:
    """Main interface for canvas data in ChromaDB."""
    
    def __init__(self):
        """Initialize collections for canvas data."""
        self.nodes_collection = client.get_or_create_collection(
            name="nodes",
            metadata={"description": "Node metadata for the canvas"}
        )
        self.edges_collection = client.get_or_create_collection(
            name="edges",
            metadata={"description": "Edge relationships between nodes"}
        )
        self.files_collection = client.get_or_create_collection(
            name="files",
            metadata={"description": "File content for semantic search"}
        )
        self.messages_collection = client.get_or_create_collection(
            name="messages",
            metadata={"description": "Conversation messages"}
        )
        self.templates_collection = client.get_or_create_collection(
            name="templates",
            metadata={"description": "Template tracking information"}
        )
    
    def sync_from_files(self, canvas_dir: str = "canvas"):
        """
        Sync data from canvas/ directory to ChromaDB.
        
        Args:
            canvas_dir: Path to canvas directory
        """
        canvas_path = Path(canvas_dir)
        
        # Sync metadata (nodes)
        self._sync_metadata(canvas_path)
        
        # Sync edges
        self._sync_edges(canvas_path)
        
        # Sync file contents
        self._sync_files(canvas_path)
        
        # Sync messages
        self._sync_messages(canvas_path)
        
        # Sync templates
        self._sync_templates(canvas_path)
    
    def _sync_metadata(self, canvas_path: Path):
        """Sync metadata.json to ChromaDB nodes collection."""
        metadata_file = canvas_path / "metadata.json"
        
        if not metadata_file.exists():
            print(f"No metadata.json found at {metadata_file}")
            return
        
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        
        ids = []
        documents = []
        metadatas = []
        
        for node_id, node_data in metadata.items():
            ids.append(node_id)
            
            # Create searchable document text (for embeddings)
            doc_text = f"{node_data.get('type', 'file')} node: {node_data.get('fileName', '')}. {node_data.get('description', '')}"
            documents.append(doc_text)
            
            # Store all fields as metadata for filtering
            metadata_entry = {
                "id": node_data.get("id", node_id),
                "type": node_data.get("type", "file"),
                "fileName": node_data.get("fileName", ""),
                "category": node_data.get("category", ""),
                "description": node_data.get("description", ""),
                "x": str(node_data.get("x", 0)),
                "y": str(node_data.get("y", 0)),
            }
            metadatas.append(metadata_entry)
        
        if ids:
            # Use upsert to update existing or add new
            self.nodes_collection.upsert(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )
            print(f"Synced {len(ids)} nodes to ChromaDB")
    
    def _sync_edges(self, canvas_path: Path):
        """Sync edges.json to ChromaDB edges collection."""
        edges_file = canvas_path / "edges.json"
        
        if not edges_file.exists():
            print(f"No edges.json found at {edges_file}")
            return
        
        with open(edges_file, 'r') as f:
            edges_data = json.load(f)
        
        edges = edges_data.get("edges", [])
        
        ids = []
        documents = []
        metadatas = []
        
        for idx, edge in enumerate(edges):
            edge_id = f"{edge['from']}_{edge['to']}_{idx}"
            ids.append(edge_id)
            
            # Create searchable document text
            doc_text = f"{edge['type']}: {edge.get('description', '')}"
            documents.append(doc_text)
            
            # Store as metadata
            metadata_entry = {
                "from": edge.get("from"),
                "to": edge.get("to"),
                "type": edge.get("type"),
                "description": edge.get("description", ""),
            }
            metadatas.append(metadata_entry)
        
        if ids:
            self.edges_collection.upsert(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )
            print(f"Synced {len(ids)} edges to ChromaDB")
    
    def _sync_files(self, canvas_path: Path):
        """Sync file contents from nodes/ directory and root to ChromaDB."""
        nodes_dir = canvas_path / "nodes"
        
        # Get files from nodes directory if it exists
        files_list = []
        if nodes_dir.exists():
            file_paths = list(nodes_dir.rglob("*"))
            files_list.extend([f for f in file_paths if f.is_file()])
        
        # Also get files from canvas root (where .py files are created)
        root_files = list(canvas_path.glob("*.py"))
        files_list.extend(root_files)
        
        if not files_list:
            print(f"No files found in {canvas_path}")
            return
        
        ids = []
        documents = []
        metadatas = []
        
        for file_path in files_list:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Use relative path as ID
                relative_path = file_path.relative_to(canvas_path)
                file_id = str(relative_path)
                
                ids.append(file_id)
                documents.append(content)
                
                metadata_entry = {
                    "path": str(relative_path),
                    "fileName": file_path.name,
                    "extension": file_path.suffix,
                    "dir": str(file_path.parent.relative_to(canvas_path)),
                }
                metadatas.append(metadata_entry)
                
            except Exception as e:
                print(f"Error reading file {file_path}: {e}")
        
        if ids:
            self.files_collection.upsert(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )
            print(f"Synced {len(ids)} files to ChromaDB")
    
    def _sync_messages(self, canvas_path: Path):
        """Sync output.json (messages) to ChromaDB."""
        messages_file = canvas_path / "output.json"
        
        if not messages_file.exists():
            print(f"No output.json found at {messages_file}")
            return
        
        with open(messages_file, 'r') as f:
            messages_data = json.load(f)
        
        messages = messages_data.get("messages", [])
        
        ids = []
        documents = []
        metadatas = []
        
        for idx, msg in enumerate(messages):
            msg_id = f"msg_{idx}"
            ids.append(msg_id)
            documents.append(msg.get("content", ""))
            metadatas.append({
                "role": msg.get("role", ""),
                "index": str(idx)
            })
        
        if ids:
            self.messages_collection.upsert(
                ids=ids,
                documents=documents,
                metadatas=metadatas
            )
            print(f"Synced {len(ids)} messages to ChromaDB")
    
    def _sync_templates(self, canvas_path: Path):
        """Sync template_tracker.json to ChromaDB."""
        templates_file = canvas_path / "template_tracker.json"
        
        if not templates_file.exists():
            print(f"No template_tracker.json found at {templates_file}")
            return
        
        with open(templates_file, 'r') as f:
            template_data = json.load(f)
        
        template_id = template_data.get("template_id", "unknown")
        
        doc_text = f"Template: {template_data.get('template_id')} in folder {template_data.get('template_folder')}"
        
        self.templates_collection.upsert(
            ids=[template_id],
            documents=[doc_text],
            metadatas=[template_data]
        )
        print(f"Synced template to ChromaDB")
    
    # Query methods
    
    def query_nodes(self, query: str, n_results: int = 5, filters: Optional[Dict] = None) -> List[Dict]:
        """
        Query nodes using semantic search.
        
        Args:
            query: Search query text
            n_results: Number of results to return
            filters: Optional metadata filters
            
        Returns:
            List of matching nodes with metadata
        """
        results = self.nodes_collection.query(
            query_texts=[query],
            n_results=n_results,
            where=filters
        )
        
        # Convert to list of dicts
        nodes = []
        if results['ids'] and results['ids'][0]:
            for i in range(len(results['ids'][0])):
                node = {
                    'id': results['ids'][0][i],
                    'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                    'distance': results['distances'][0][i] if results['distances'] else None
                }
                nodes.append(node)
        
        return nodes
    
    def query_files(self, query: str, n_results: int = 5, filters: Optional[Dict] = None) -> List[Dict]:
        """
        Query files using semantic search on their content.
        
        Args:
            query: Search query text
            n_results: Number of results to return
            filters: Optional metadata filters (e.g., {'extension': '.tsx'})
            
        Returns:
            List of matching files with content and metadata
        """
        results = self.files_collection.query(
            query_texts=[query],
            n_results=n_results,
            where=filters
        )
        
        files = []
        if results['ids'] and results['ids'][0]:
            for i in range(len(results['ids'][0])):
                file_info = {
                    'id': results['ids'][0][i],
                    'content': results['documents'][0][i] if results['documents'] else '',
                    'metadata': results['metadatas'][0][i] if results['metadatas'] else {},
                    'distance': results['distances'][0][i] if results['distances'] else None
                }
                files.append(file_info)
        
        return files
    
    def get_all_nodes(self) -> Dict:
        """Get all nodes from the collection."""
        results = self.nodes_collection.get(include=["metadatas", "documents"])
        
        nodes = {}
        for i, node_id in enumerate(results['ids']):
            nodes[node_id] = results['metadatas'][i]
        
        return nodes
    
    def export_to_files(self, canvas_dir: str = "canvas"):
        """
        Export data from ChromaDB back to canvas/ directory files.
        Useful for reverting or backing up.
        """
        canvas_path = Path(canvas_dir)
        canvas_path.mkdir(parents=True, exist_ok=True)
        
        # Export nodes
        nodes = self.get_all_nodes()
        with open(canvas_path / "metadata.json", 'w') as f:
            json.dump(nodes, f, indent=2)
        
        # Export edges
        results = self.edges_collection.get(include=["metadatas", "documents"])
        edges = []
        for i, edge_id in enumerate(results['ids']):
            metadata = results['metadatas'][i]
            edge = {
                "from": metadata.get("from"),
                "to": metadata.get("to"),
                "type": metadata.get("type"),
                "description": metadata.get("description", "")
            }
            edges.append(edge)
        
        with open(canvas_path / "edges.json", 'w') as f:
            json.dump({"edges": edges}, f, indent=2)
        
        print(f"Exported canvas data to {canvas_dir}")
    
    def clear_all(self):
        """Clear all collections. Use with caution!"""
        self.nodes_collection.delete()
        self.edges_collection.delete()
        self.files_collection.delete()
        self.messages_collection.delete()
        self.templates_collection.delete()
        
        print("Cleared all collections")


def main():
    """Test the CanvasDB sync functionality."""
    db = CanvasDB()
    
    # Sync from files to ChromaDB
    print("Syncing canvas/ to ChromaDB...")
    db.sync_from_files()
    
    print("\nTesting queries...")
    
    # Query nodes
    print("\nQuerying for 'Hero' nodes:")
    results = db.query_nodes("Hero")
    for result in results:
        print(f"  - {result['metadata']}")
    
    # Query files
    print("\nQuerying for 'component' files:")
    results = db.query_files("component", n_results=3)
    for result in results[:2]:  # Show first 2
        print(f"  - {result['metadata']['fileName']} (distance: {result['distance']:.3f})")
        print(f"    Content preview: {result['content'][:100]}...")


if __name__ == "__main__":
    main()

