"""
Node Generation Agent - Generates nodes based on conversation history using Anthropic SDK.
"""

import os
import re
import json as json_module
from typing import Optional
from dotenv import load_dotenv
from anthropic import Anthropic

# Load environment variables
load_dotenv()

# Path to metadata.json - go up from backend/agents to backend, then to root, then into canvas
METADATA_PATH = "/home/ryan/dev/nody/canvas/metadata.json"
print(f"METADATA_PATH set to: {METADATA_PATH}")

def load_metadata() -> dict:
    """Load metadata from metadata.json file."""
    if not os.path.exists(METADATA_PATH):
        return {}
    try:
        with open(METADATA_PATH, 'r', encoding='utf-8') as f:
            return json_module.load(f)
    except Exception as e:
        print(f"Error loading metadata: {e}")
        return {}

def save_metadata(metadata: dict) -> bool:
    """Save metadata to metadata.json file."""
    try:
        os.makedirs(os.path.dirname(METADATA_PATH), exist_ok=True)
        with open(METADATA_PATH, 'w', encoding='utf-8') as f:
            json_module.dump(metadata, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving metadata: {e}")
        return False

def add_nodes_to_metadata(nodes: list) -> dict:
    """
    Parse and save nodes to metadata.json.
    
    Args:
        nodes: Array of nodes to add to the canvas. Each node should have:
               - id: Unique node identifier
               - type: Node type (must be 'file')
               - description: Description of what the node does
               - x: X coordinate
               - y: Y coordinate
               - fileName: File name for file nodes (optional)
    
    Returns:
        dict: Dictionary with success status, message, and parsed_nodes array
    """
    # Import here to ensure it's available in sandbox
    import json as json_module
    import os
    
    def load_metadata_local() -> dict:
        """Load metadata from metadata.json file."""
        if not os.path.exists(METADATA_PATH):
            return {}
        try:
            with open(METADATA_PATH, 'r', encoding='utf-8') as f:
                return json_module.load(f)
        except Exception as e:
            print(f"Error loading metadata: {e}")
            return {}
    
    def save_metadata_local(metadata: dict) -> bool:
        """
        Save metadata to metadata.json file.
        
        Args:
            metadata: Dictionary containing node metadata to save to the file.
        
        Returns:
            bool: True if save was successful, False otherwise.
        """
        try:
            with open(METADATA_PATH, 'w', encoding='utf-8') as f:
                json_module.dump(metadata, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving metadata: {e}")
            return False
    
    try:
        print(f"\n=== add_nodes_to_metadata TOOL CALLED ===")
        print(f"Received {len(nodes)} nodes: {nodes}")
        
        # Parse nodes if they are JSON strings
        parsed_nodes = []
        for node in nodes:
            if isinstance(node, str):
                try:
                    # Parse as JSON
                    parsed = json_module.loads(node)
                    parsed_nodes.append(parsed)
                except Exception as e:
                    print(f"Failed to parse node: {node}, error: {e}")
                    continue
            else:
                parsed_nodes.append(node)
        
        print(f"Parsed {len(parsed_nodes)} nodes from {len(nodes)} input")
        
        # Load existing metadata
        metadata = load_metadata_local()
        print(f"Loaded existing metadata with {len(metadata)} nodes")
        
        # Add each node to metadata
        for node in parsed_nodes:
            node_id = node.get("id")
            if not node_id:
                print(f"Skipping node without ID: {node}")
                continue
            
            node_data = {
                "id": node_id,
                "type": node.get("type", "file"),
                "description": node.get("description", ""),
                "x": node.get("x", 100.0),
                "y": node.get("y", 100.0),
            }
            
            if "fileName" in node:
                file_name = node["fileName"]
                # Remove leading "nodes/" if present to avoid duplicate path
                if file_name.startswith("nodes/"):
                    file_name = file_name[len("nodes/"):]
                node_data["fileName"] = file_name
            
            metadata[node_id] = node_data
            print(f"Added node {node_id} to metadata")
        
        # Save metadata
        if save_metadata_local(metadata):
            print(f"Successfully saved metadata with {len(metadata)} nodes")
            return {"success": True, "message": f"Added {len(parsed_nodes)} nodes to metadata", "parsed_nodes": parsed_nodes}
        else:
            print("Failed to save metadata")
            return {"success": False, "message": "Failed to save metadata", "parsed_nodes": parsed_nodes}
    
    except Exception as e:
        print(f"Exception in add_nodes_to_metadata: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "message": f"Error: {str(e)}", "parsed_nodes": []}

def get_metadata() -> dict:
    """
    Get the current metadata from the canvas.
    
    Returns:
        Dict containing all current node metadata
    """
    return load_metadata()


def create_node_generation_agent():
    """
    Create an Anthropic client for generating nodes based on conversation history.
    
    This uses Anthropic Claude to:
    - Analyze conversation history to understand user intent
    - Generate appropriate file nodes
    - Create node descriptions
    - Use tools to add nodes to metadata
    
    Returns:
        Anthropic client instance
    """
    # Initialize Anthropic client
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable is required")
    
    client = Anthropic(api_key=api_key)
    print("Connected to Anthropic")
    
    return client

def get_tools():
    """
    Define the tools available to the agent.
    
    Returns:
        list: List of tool definitions for Anthropic API
    """
    tools = [
        {
            "name": "get_metadata",
            "description": "Get the current metadata from the canvas showing all existing nodes.",
            "input_schema": {
                "type": "object",
                "properties": {}
            }
        },
        {
            "name": "add_nodes_to_metadata",
            "description": "Parse and save nodes to metadata.json.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "nodes": {
                        "type": "array",
                        "description": "Array of nodes to add to the canvas. Each node should have id, type, description, x, y, and fileName.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "type": {"type": "string"},
                                "description": {"type": "string"},
                                "x": {"type": "number"},
                                "y": {"type": "number"},
                                "fileName": {"type": "string"}
                            }
                        }
                    }
                },
                "required": ["nodes"]
            }
        }
    ]
    return tools

def execute_tool(tool_name, tool_args):
    """
    Execute a tool by name with the given arguments.
    
    Args:
        tool_name: Name of the tool to execute
        tool_args: Arguments for the tool
    
    Returns:
        Tool result as a dict
    """
    if tool_name == "get_metadata":
        result = get_metadata()
        return result
    elif tool_name == "add_nodes_to_metadata":
        nodes = tool_args.get("nodes", [])
        result = add_nodes_to_metadata(nodes)
        return result
    else:
        return {"error": f"Unknown tool: {tool_name}"}
    
    

def generate_nodes_from_conversation(client, conversation_history):
    """
    Generate nodes based on conversation history using Anthropic SDK with tools.
    
    Args:
        client: Anthropic client instance
        conversation_history: List of messages in format [{"role": "user|assistant", "content": "..."}, ...]
    
    Returns:
        tuple: (generated_nodes, assistant_message)
    """
    try:
        # Load current metadata to provide context
        current_metadata = load_metadata()
        
        # Prepare messages for the agent with context
        messages = []
        
        # Add context about existing nodes
        if current_metadata:
            context_message = f"""Current nodes in the canvas:
{json_module.dumps(current_metadata, indent=2)}

Please analyze the user's request and generate NEW nodes. Do NOT duplicate existing nodes."""
            messages.append({"role": "user", "content": context_message})
        
        # Add conversation history
        for msg in conversation_history:
            messages.append(msg)
        
        print(f"Sending {len(messages)} messages to Anthropic")
        
        # Track generated nodes and assistant message
        generated_nodes_list = []
        assistant_message = ""
        
        # Get available tools
        tools = get_tools()
        
        # Call Anthropic with tool use
        max_iterations = 10
        iteration = 0
        
        while iteration < max_iterations:
            iteration += 1
            print(f"\n=== Iteration {iteration} ===")
            
            # Make API call
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                messages=messages,
                tools=tools
            )
            
            print(f"Received response: {response.stop_reason}")
            
            # Build assistant message content
            assistant_content = []
            tool_results = []
            
            # Handle the response
            for block in response.content:
                if block.type == "text":
                    assistant_message += block.text
                    assistant_content.append({
                        "type": "text",
                        "text": block.text
                    })
                    print(f"Text: {block.text[:100]}...")
                elif block.type == "tool_use":
                    # Tool was called
                    tool_name = block.name
                    tool_id = block.id
                    tool_args = block.input
                    
                    print(f"\n=== TOOL CALL: {tool_name} ===")
                    print(f"Args: {tool_args}")
                    
                    # Execute the tool
                    try:
                        tool_result = execute_tool(tool_name, tool_args)
                        print(f"Tool result: {tool_result}")
                        
                        # Store nodes if add_nodes_to_metadata was successful
                        if tool_name == "add_nodes_to_metadata" and isinstance(tool_result, dict):
                            if tool_result.get("success") and "parsed_nodes" in tool_result:
                                generated_nodes_list = tool_result["parsed_nodes"]
                                print(f"Generated {len(generated_nodes_list)} nodes")
                        
                        # Add tool result to results list
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tool_id,
                            "content": json_module.dumps(tool_result)
                        })
                        
                        # Keep track of the tool use block for the assistant message
                        assistant_content.append({
                            "type": "tool_use",
                            "id": tool_id,
                            "name": tool_name,
                            "input": tool_args
                        })
                        
                    except Exception as e:
                        print(f"Error executing tool: {e}")
                        import traceback
                        traceback.print_exc()
            
            # Add assistant message with all content
            if assistant_content:
                messages.append({
                    "role": "assistant",
                    "content": assistant_content
                })
            
            # If there are tool results, add them as a user message
            if tool_results:
                messages.append({
                    "role": "user",
                    "content": tool_results
                })
            
            # Check if we should stop
            if response.stop_reason == "end_turn":
                # No more tool calls, we're done
                break
            elif response.stop_reason == "tool_use":
                # More tool calls expected, continue
                continue
            else:
                # Stop for other reasons
                break
        
        # If nodes were generated, create a summary message
        if generated_nodes_list:
            assistant_message = f"Successfully created {len(generated_nodes_list)} nodes. The following files have been added to your canvas:\n"
            for node in generated_nodes_list:
                assistant_message += f"- **{node.get('fileName', 'unknown')}**: {node.get('description', '')}\n"
            return generated_nodes_list, assistant_message
        
        # Return the assistant message if no nodes were generated
        return None, assistant_message
        
    except Exception as e:
        print(f"Error generating nodes: {e}")
        import traceback
        traceback.print_exc()
        return None, f"Error generating nodes: {str(e)}"
