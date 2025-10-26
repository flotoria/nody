"""
Example usage of CanvasDB for semantic search over canvas data.

This demonstrates how to use ChromaDB for:
1. Syncing canvas data to ChromaDB
2. Querying nodes semantically
3. Querying files by content
4. Filtering results by metadata
"""

from db import CanvasDB


def main():
    # Initialize the database
    print("🎨 Initializing CanvasDB...")
    db = CanvasDB()
    
    # Sync from files (only needed once or when canvas data changes)
    print("\n📥 Syncing canvas data to ChromaDB...")
    db.sync_from_files()
    
    # Example 1: Query nodes by description
    print("\n" + "="*60)
    print("EXAMPLE 1: Query nodes semantically")
    print("="*60)
    print("\nSearching for nodes related to 'Hero' component...")
    results = db.query_nodes("Hero", n_results=3)
    for i, result in enumerate(results, 1):
        metadata = result['metadata']
        print(f"\n{i}. File: {metadata.get('fileName', 'N/A')}")
        print(f"   Type: {metadata.get('type', 'N/A')}")
        print(f"   Category: {metadata.get('category', 'N/A')}")
        print(f"   Description: {metadata.get('description', 'N/A')}")
        print(f"   Similarity Score: {result.get('distance', 0):.3f}")
    
    # Example 2: Query files by content
    print("\n" + "="*60)
    print("EXAMPLE 2: Query files by content")
    print("="*60)
    print("\nSearching for files containing 'component' logic...")
    results = db.query_files("component", n_results=3)
    for i, result in enumerate(results, 1):
        metadata = result['metadata']
        content = result.get('content', '')
        print(f"\n{i}. File: {metadata.get('fileName', 'N/A')}")
        print(f"   Path: {metadata.get('path', 'N/A')}")
        print(f"   Extension: {metadata.get('extension', 'N/A')}")
        print(f"   Content preview: {content[:100]}...")
        print(f"   Similarity Score: {result.get('distance', 0):.3f}")
    
    # Example 3: Query with filters
    print("\n" + "="*60)
    print("EXAMPLE 3: Query with metadata filters")
    print("="*60)
    print("\nSearching for 'Web & API' category nodes...")
    results = db.query_nodes(
        "components",
        n_results=5,
        filters={"category": "Web & API"}
    )
    for i, result in enumerate(results, 1):
        metadata = result['metadata']
        print(f"{i}. {metadata.get('fileName')}: {metadata.get('description')}")
    
    # Example 4: Filter files by extension
    print("\n" + "="*60)
    print("EXAMPLE 4: Filter files by extension")
    print("="*60)
    print("\nSearching for .tsx files...")
    results = db.query_files(
        "component",
        n_results=3,
        filters={"extension": ".tsx"}
    )
    for i, result in enumerate(results, 1):
        metadata = result['metadata']
        print(f"{i}. {metadata.get('fileName')} in {metadata.get('dir')}")
    
    # Example 5: Get all data
    print("\n" + "="*60)
    print("EXAMPLE 5: Get all nodes")
    print("="*60)
    all_nodes = db.get_all_nodes()
    print(f"\nTotal nodes in database: {len(all_nodes)}")
    for node_id, node_data in list(all_nodes.items())[:5]:  # Show first 5
        print(f"  - {node_id}: {node_data.get('fileName')}")
    
    print("\n" + "="*60)
    print("✅ All examples completed!")
    print("="*60)
    print("\n💡 Tips:")
    print("  - Use semantic queries to find similar code")
    print("  - Use metadata filters for exact matches")
    print("  - Distance scores show similarity (lower = more similar)")
    print("  - Sync again after updating canvas/ files")


if __name__ == "__main__":
    main()

