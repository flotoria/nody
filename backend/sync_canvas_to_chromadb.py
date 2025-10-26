"""
Script to sync canvas/ directory to ChromaDB.

Usage:
    python sync_canvas_to_chromadb.py
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from db.canvas_db import CanvasDB


def main():
    """Sync canvas data to ChromaDB."""
    print("Initializing CanvasDB...")
    db = CanvasDB()
    
    print("\nSyncing canvas/ to ChromaDB...")
    db.sync_from_files()
    
    print("\n" + "="*50)
    print("Sync complete!")
    print("="*50)
    
    # Test some queries
    print("\n\nTesting semantic queries...")
    
    # Query nodes by description
    print("\n🔍 Querying nodes for 'Hero':")
    results = db.query_nodes("Hero", n_results=3)
    for result in results:
        metadata = result['metadata']
        print(f"  - {metadata.get('fileName', 'N/A')}: {metadata.get('description', 'N/A')}")
        print(f"    Category: {metadata.get('category', 'N/A')}, Distance: {result.get('distance', 0):.3f}")
    
    # Query files by content
    print("\n🔍 Querying files for 'component':")
    results = db.query_files("component", n_results=2)
    for result in results:
        metadata = result['metadata']
        print(f"  - {metadata.get('fileName', 'N/A')} ({metadata.get('extension', 'N/A')})")
        content_preview = result.get('content', '')[:80]
        print(f"    Content preview: {content_preview}...")
    
    print("\n" + "="*50)
    print("Query tests complete!")
    print("="*50)
    print("\nYou can now use CanvasDB in your application!")
    print("\nExample usage:")
    print("""
    from db import CanvasDB
    
    db = CanvasDB()
    
    # Query nodes semantically
    results = db.query_nodes("React components")
    
    # Query files by content
    results = db.query_files("authentication logic")
    
    # Get all nodes
    all_nodes = db.get_all_nodes()
    """)


if __name__ == "__main__":
    main()

