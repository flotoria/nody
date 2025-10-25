"""
File System Agent - Handles file operations and code generation.
This agent is responsible for creating, editing, and managing files.
"""

import os
from dotenv import load_dotenv
from letta_client import Letta
from tools import (
    read_file, write_file, delete_file, delete_directory, list_files,
    create_directory, copy_file, move_file, get_file_info, search_files,
    edit_file_content, append_to_file, get_current_directory, change_directory
)

# Load environment variables
load_dotenv()


def create_file_system_agent():
    """
    Create a Letta agent with comprehensive file system tools.
    
    Returns:
        tuple: (Letta client, agent instance)
    """
    # Initialize Letta client
    if os.getenv("LETTA_API_KEY"):
        client = Letta(token=os.getenv("LETTA_API_KEY"))
        print("Connected to Letta Cloud")
    else:
        base_url = os.getenv("LETTA_BASE_URL", "http://localhost:8283")
        client = Letta(base_url=base_url)
        print(f"Connected to self-hosted Letta server at {base_url}")
    
    # Create custom tools from our tools module
    tools = [
        client.tools.create_from_function(func=read_file),
        client.tools.create_from_function(func=write_file),
        client.tools.create_from_function(func=delete_file),
        client.tools.create_from_function(func=delete_directory),
        client.tools.create_from_function(func=list_files),
        client.tools.create_from_function(func=create_directory),
        client.tools.create_from_function(func=copy_file),
        client.tools.create_from_function(func=move_file),
        client.tools.create_from_function(func=get_file_info),
        client.tools.create_from_function(func=search_files),
        client.tools.create_from_function(func=edit_file_content),
        client.tools.create_from_function(func=append_to_file),
        client.tools.create_from_function(func=get_current_directory),
        client.tools.create_from_function(func=change_directory),
    ]
    
    # Create agent with memory blocks and tools
    agent = client.agents.create(
        memory_blocks=[
            {
                "label": "persona",
                "value": """I am a comprehensive file system assistant with extensive capabilities for file and directory operations. I can help you with:

- Reading and writing files
- Creating and deleting files and directories
- Copying and moving files
- Searching for files by pattern
- Editing file content
- Managing directory structures
- Getting detailed file information
- Navigating the file system

I'm precise, helpful, and always confirm operations before performing destructive actions. I provide clear feedback about what I'm doing and any errors that occur."""
            },
            {
                "label": "human",
                "value": "The user is a developer working on a project called 'nody' with both frontend and backend components. They need assistance with file operations, code editing, and project management."
            },
            {
                "label": "project_context",
                "value": """Current project structure:
- /home/ryan/dev/nody/ - Project root
- /home/ryan/dev/nody/backend/ - Python backend with Letta agent
- /home/ryan/dev/nody/frontend/ - Next.js frontend

The backend uses Letta for AI-powered file operations and the frontend is a Next.js application.""",
                "description": "Stores information about the current project structure and context"
            },
            {
                "label": "safety_guidelines",
                "value": """Important safety guidelines for file operations:
1. Always confirm before deleting files or directories
2. Create backups when making significant changes
3. Check file permissions before operations
4. Provide clear error messages when operations fail
5. Be cautious with recursive operations
6. Validate file paths before operations""",
                "description": "Safety guidelines for file system operations"
            }
        ],
        tools=[tool.name for tool in tools] + ["web_search", "run_code"],
        model="openai/gpt-4o-mini",
        embedding="openai/text-embedding-3-small"
    )
    
    print(f"Created file system agent with ID: {agent.id}")
    
    return client, agent


