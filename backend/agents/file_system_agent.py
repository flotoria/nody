"""
File System Agent - Anthropic agent with comprehensive file system tools.
"""

import os
import json
from typing import Dict, Any, List
from dotenv import load_dotenv
import anthropic
from tools import (
    read_file, write_file, delete_file, delete_directory, list_files,
    create_directory, copy_file, move_file, get_file_info, search_files,
    edit_file_content, append_to_file, get_current_directory, change_directory
)

# Load environment variables
load_dotenv()

# Path to canvas/files directory
CANVAS_FILES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "canvas", "files")

def load_canvas_files():
    """Load all files from canvas/files/ directory and return as memory blocks."""
    memory_blocks = []
    
    if not os.path.exists(CANVAS_FILES_DIR):
        return memory_blocks
    
    try:
        for filename in os.listdir(CANVAS_FILES_DIR):
            file_path = os.path.join(CANVAS_FILES_DIR, filename)
            if os.path.isfile(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    memory_blocks.append({
                        "label": filename,
                        "value": content,
                        "description": f"Content of {filename} file"
                    })
                except Exception as e:
                    print(f"Error reading file {filename}: {e}")
    except Exception as e:
        print(f"Error loading canvas files: {e}")
    
    return memory_blocks


def create_file_system_agent():
    """
    Create an Anthropic agent with comprehensive file system tools.
    
    Returns:
        tuple: (Anthropic client, agent configuration)
    """
    # Initialize Anthropic client
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable is required")
    
    client = anthropic.Anthropic(api_key=api_key)
    print("Connected to Anthropic API")
    
    # Define tools for the agent
    tools = [
        {
            "name": "read_file",
            "description": "Read the contents of a file",
            "input_schema": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to the file to read"}
                },
                "required": ["file_path"]
            }
        },
        {
            "name": "write_file",
            "description": "Write content to a file",
            "input_schema": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to the file to write"},
                    "content": {"type": "string", "description": "Content to write to the file"}
                },
                "required": ["file_path", "content"]
            }
        },
        {
            "name": "delete_file",
            "description": "Delete a file",
            "input_schema": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to the file to delete"}
                },
                "required": ["file_path"]
            }
        },
        {
            "name": "delete_directory",
            "description": "Delete a directory and all its contents",
            "input_schema": {
                "type": "object",
                "properties": {
                    "dir_path": {"type": "string", "description": "Path to the directory to delete"}
                },
                "required": ["dir_path"]
            }
        },
        {
            "name": "list_files",
            "description": "List files and directories in a directory",
            "input_schema": {
                "type": "object",
                "properties": {
                    "dir_path": {"type": "string", "description": "Path to the directory to list"}
                },
                "required": ["dir_path"]
            }
        },
        {
            "name": "create_directory",
            "description": "Create a new directory",
            "input_schema": {
                "type": "object",
                "properties": {
                    "dir_path": {"type": "string", "description": "Path to the directory to create"}
                },
                "required": ["dir_path"]
            }
        },
        {
            "name": "copy_file",
            "description": "Copy a file from source to destination",
            "input_schema": {
                "type": "object",
                "properties": {
                    "source": {"type": "string", "description": "Source file path"},
                    "destination": {"type": "string", "description": "Destination file path"}
                },
                "required": ["source", "destination"]
            }
        },
        {
            "name": "move_file",
            "description": "Move a file from source to destination",
            "input_schema": {
                "type": "object",
                "properties": {
                    "source": {"type": "string", "description": "Source file path"},
                    "destination": {"type": "string", "description": "Destination file path"}
                },
                "required": ["source", "destination"]
            }
        },
        {
            "name": "get_file_info",
            "description": "Get detailed information about a file",
            "input_schema": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to the file"}
                },
                "required": ["file_path"]
            }
        },
        {
            "name": "search_files",
            "description": "Search for files matching a pattern",
            "input_schema": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Search pattern"},
                    "directory": {"type": "string", "description": "Directory to search in"}
                },
                "required": ["pattern", "directory"]
            }
        },
        {
            "name": "edit_file_content",
            "description": "Edit specific content in a file",
            "input_schema": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to the file"},
                    "old_content": {"type": "string", "description": "Content to replace"},
                    "new_content": {"type": "string", "description": "New content"}
                },
                "required": ["file_path", "old_content", "new_content"]
            }
        },
        {
            "name": "append_to_file",
            "description": "Append content to a file",
            "input_schema": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to the file"},
                    "content": {"type": "string", "description": "Content to append"}
                },
                "required": ["file_path", "content"]
            }
        },
        {
            "name": "get_current_directory",
            "description": "Get the current working directory",
            "input_schema": {
                "type": "object",
                "properties": {}
            }
        },
        {
            "name": "change_directory",
            "description": "Change the current working directory",
            "input_schema": {
                "type": "object",
                "properties": {
                    "dir_path": {"type": "string", "description": "Path to the directory"}
                },
                "required": ["dir_path"]
            }
        }
    ]
    
    # Load canvas files as context
    canvas_files = load_canvas_files()
    
    # Create agent configuration
    agent_config = {
        "model": "claude-3-5-sonnet-20241022",
        "tools": tools,
        "system": f"""You are a comprehensive file system assistant with extensive capabilities for file and directory operations. You can help with:

- Reading and writing node files
- Creating and deleting node files and directories
- Copying and moving node files
- Searching for node files by pattern
- Editing file content
- Managing directory structures
- Getting detailed file information
- Navigating the file system

I'm precise, helpful, and always confirm operations before performing destructive actions. I provide clear feedback about what I'm doing and any errors that occur.

Current project structure:
- /home/ryan/dev/nody/ - Project root
- /home/ryan/dev/nody/backend/ - Python backend with Anthropic agent
- /home/ryan/dev/nody/frontend/ - Next.js frontend

The backend uses Anthropic for AI-powered file operations and the frontend is a Next.js application.

Important safety guidelines for file operations:
1. Always confirm before deleting files or directories
2. Create backups when making significant changes
3. Check file permissions before operations
4. Provide clear error messages when operations fail
5. Be cautious with recursive operations
6. Validate file paths before operations

Current canvas files:
{json.dumps(canvas_files, indent=2) if canvas_files else "No canvas files found"}"""
    }
    
    print(f"Created file system agent with Anthropic SDK")
    print(f"Agent has {len(tools)} file system tools")
    
    return client, agent_config


def interact_with_agent(client, agent_config):
    """
    Interactive loop to chat with the agent.
    
    Args:
        client: Anthropic client instance
        agent_config: Agent configuration
    """
    print("\n" + "="*60)
    print("File System Agent Ready!")
    print("="*60)
    print("You can now ask me to help with file operations like:")
    print("- 'Read the contents of main.py'")
    print("- 'Create a new file called test.txt with some content'")
    print("- 'List all node files in the current directory'")
    print("- 'Search for all Python node files in the project'")
    print("- 'Edit the main.py file to add a new function'")
    print("\nType 'quit' to exit.")
    print("="*60)
    
    messages = []
    
    while True:
        try:
            user_input = input("\nYou: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'q']:
                print("Goodbye!")
                break
            
            if not user_input:
                continue
            
            # Add user message
            messages.append({"role": "user", "content": user_input})
            
            # Send message to agent
            response = client.messages.create(
                model=agent_config["model"],
                max_tokens=4000,
                system=agent_config["system"],
                tools=agent_config["tools"],
                messages=messages
            )
            
            # Process and display response
            print("\nAgent:")
            assistant_message = ""
            tool_results = []
            
            for content_block in response.content:
                if content_block.type == "text":
                    assistant_message += content_block.text
                elif content_block.type == "tool_use":
                    # Handle tool calls
                    tool_name = content_block.name
                    tool_input = content_block.input
                    
                    print(f"[Tool: {tool_name}]")
                    
                    # Execute the tool
                    try:
                        if tool_name == "read_file":
                            result = read_file(tool_input.get("file_path"))
                        elif tool_name == "write_file":
                            result = write_file(tool_input.get("file_path"), tool_input.get("content"))
                        elif tool_name == "delete_file":
                            result = delete_file(tool_input.get("file_path"))
                        elif tool_name == "delete_directory":
                            result = delete_directory(tool_input.get("dir_path"))
                        elif tool_name == "list_files":
                            result = list_files(tool_input.get("dir_path"))
                        elif tool_name == "create_directory":
                            result = create_directory(tool_input.get("dir_path"))
                        elif tool_name == "copy_file":
                            result = copy_file(tool_input.get("source"), tool_input.get("destination"))
                        elif tool_name == "move_file":
                            result = move_file(tool_input.get("source"), tool_input.get("destination"))
                        elif tool_name == "get_file_info":
                            result = get_file_info(tool_input.get("file_path"))
                        elif tool_name == "search_files":
                            result = search_files(tool_input.get("pattern"), tool_input.get("directory"))
                        elif tool_name == "edit_file_content":
                            result = edit_file_content(tool_input.get("file_path"), tool_input.get("old_content"), tool_input.get("new_content"))
                        elif tool_name == "append_to_file":
                            result = append_to_file(tool_input.get("file_path"), tool_input.get("content"))
                        elif tool_name == "get_current_directory":
                            result = get_current_directory()
                        elif tool_name == "change_directory":
                            result = change_directory(tool_input.get("dir_path"))
                        else:
                            result = f"Unknown tool: {tool_name}"
                        
                        print(f"[Tool Result: {result}]")
                        
                        # Add tool result to messages
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": content_block.id,
                            "content": str(result)
                        })
                    except Exception as e:
                        print(f"[Tool Error: {e}]")
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": content_block.id,
                            "content": f"Error: {str(e)}"
                        })
            
            if assistant_message:
                print(assistant_message)
            
            # Add assistant message to conversation
            messages.append({
                "role": "assistant",
                "content": response.content
            })
            
            # If there are tool results, send them back
            if tool_results:
                messages.append({
                    "role": "user",
                    "content": tool_results
                })
                
                # Get final response
                final_response = client.messages.create(
                    model=agent_config["model"],
                    max_tokens=4000,
                    system=agent_config["system"],
                    tools=agent_config["tools"],
                    messages=messages
                )
                
                # Display final response
                for content_block in final_response.content:
                    if content_block.type == "text":
                        print(content_block.text)
                
                # Add final response to messages
                messages.append({
                    "role": "assistant",
                    "content": final_response.content
                })
                    
        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    try:
        client, agent_config = create_file_system_agent()
        interact_with_agent(client, agent_config)
    except Exception as e:
        print(f"Failed to create agent: {e}")
        print("\nMake sure you have:")
        print("1. Set ANTHROPIC_API_KEY environment variable")
        print("2. Installed dependencies: pip install -e .")
