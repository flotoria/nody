"""
Letta agent setup with comprehensive file system tools.
This module creates and configures a Letta agent with extensive file operation capabilities.
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
        Letta agent instance
    """
    # Initialize Letta client
    # Check if using Letta Cloud or self-hosted
    if os.getenv("LETTA_API_KEY"):
        # Using Letta Cloud
        client = Letta(token=os.getenv("LETTA_API_KEY"))
        print("Connected to Letta Cloud")
    else:
        # Using self-hosted Letta server
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
        tools=[tool.name for tool in tools] + ["web_search", "run_code"],  # Include built-in tools too
        model="openai/gpt-4o-mini",  # Using cost-effective model
        embedding="openai/text-embedding-3-small"
    )
    
    print(f"Created agent with ID: {agent.id}")
    print(f"Agent has {len(tools)} custom file system tools plus built-in tools")
    
    return client, agent


def interact_with_agent(client, agent_id):
    """
    Interactive loop to chat with the agent.
    
    Args:
        client: Letta client instance
        agent_id: ID of the agent to interact with
    """
    print("\n" + "="*60)
    print("File System Agent Ready!")
    print("="*60)
    print("You can now ask me to help with file operations like:")
    print("- 'Read the contents of main.py'")
    print("- 'Create a new file called test.txt with some content'")
    print("- 'List all files in the current directory'")
    print("- 'Search for all Python files in the project'")
    print("- 'Edit the main.py file to add a new function'")
    print("\nType 'quit' to exit.")
    print("="*60)
    
    while True:
        try:
            user_input = input("\nYou: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'q']:
                print("Goodbye!")
                break
            
            if not user_input:
                continue
            
            # Send message to agent
            response = client.agents.messages.create(
                agent_id=agent_id,
                messages=[{"role": "user", "content": user_input}]
            )
            
            # Process and display response
            print("\nAgent:")
            for msg in response.messages:
                if msg.message_type == "assistant_message":
                    print(msg.content)
                elif msg.message_type == "reasoning_message":
                    print(f"[Reasoning: {msg.reasoning}]")
                elif msg.message_type == "tool_call_message":
                    print(f"[Tool: {msg.tool_call.name}]")
                elif msg.message_type == "tool_return_message":
                    print(f"[Tool Result: {msg.tool_return}]")
                    
        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    try:
        client, agent = create_file_system_agent()
        interact_with_agent(client, agent.id)
    except Exception as e:
        print(f"Failed to create agent: {e}")
        print("\nMake sure you have:")
        print("1. Set LETTA_API_KEY environment variable for Letta Cloud, OR")
        print("2. Started a self-hosted Letta server and set LETTA_BASE_URL")
        print("3. Installed dependencies: pip install -e .")
