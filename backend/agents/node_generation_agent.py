"""
Node Generation Agent - Generates nodes based on conversation history using Anthropic SDK.
"""

import os
import json
from typing import Dict, Any, List
from dotenv import load_dotenv
import anthropic

# Load environment variables
load_dotenv()

# Path to metadata.json - go up from backend/agents to backend, then to root, then into canvas
METADATA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "canvas", "metadata.json")

def load_metadata() -> Dict[str, Any]:
    """Load metadata from metadata.json file."""
    if not os.path.exists(METADATA_PATH):
        return {}
    try:
        with open(METADATA_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading metadata: {e}")
        return {}

def save_metadata(metadata: Dict[str, Any]) -> bool:
    """Save metadata to metadata.json file."""
    try:
        os.makedirs(os.path.dirname(METADATA_PATH), exist_ok=True)
        with open(METADATA_PATH, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving metadata: {e}")
        return False

def add_nodes_to_metadata(nodes: list) -> Dict[str, Any]:
    """Add multiple nodes to metadata.json at once."""
    try:
        metadata = load_metadata()
        
        # Check for conflicting fileNames first
        for node in nodes:
            if "fileName" in node:
                fileName = node["fileName"]
                # Check if this fileName already exists in metadata
                for existing_id, existing_node in metadata.items():
                    if existing_node.get("fileName") == fileName and existing_id != node.get("id"):
                        return {
                            "success": False, 
                            "message": f"FileName conflict: '{fileName}' already exists for node '{existing_id}'"
                        }
        
        # If no conflicts, add all nodes
        for node in nodes:
            node_id = node.get("id")
            if not node_id:
                return {"success": False, "message": "Each node must have an 'id' field"}
            
            node_data = {
                "id": node_id,
                "type": node.get("type", "file"),
                "description": node.get("description", ""),
                "x": node.get("x", 100.0),
                "y": node.get("y", 100.0),
            }
            
            if "fileName" in node:
                node_data["fileName"] = node["fileName"]
            
            metadata[node_id] = node_data
        
        if save_metadata(metadata):
            return {"success": True, "message": f"Added {len(nodes)} nodes to metadata"}
        else:
            return {"success": False, "message": "Failed to save metadata"}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

def get_metadata() -> Dict[str, Any]:
    """Get the current metadata."""
    return load_metadata()


def create_node_generation_agent():
    """
    Create an Anthropic agent for generating nodes based on conversation history.
    
    This agent:
    - Analyzes conversation history to understand user intent
    - Generates appropriate file nodes
    - Creates node descriptions
    - Uses tools to add nodes to metadata
    
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
            "name": "get_metadata",
            "description": "Get the current metadata from the canvas",
            "input_schema": {
                "type": "object",
                "properties": {}
            }
        },
        {
            "name": "add_nodes_to_metadata",
            "description": "Add multiple nodes to the canvas metadata. Each node should have: id, type, description, x, y coordinates, and optionally fileName for file nodes.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "nodes": {
                        "type": "array",
                        "description": "Array of nodes to add to the canvas",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string", "description": "Unique node identifier"},
                                "type": {"type": "string", "description": "Node type (must be 'file')"},
                                "description": {"type": "string", "description": "Description of what the node does"},
                                "x": {"type": "number", "description": "X coordinate"},
                                "y": {"type": "number", "description": "Y coordinate"},
                                "fileName": {"type": "string", "description": "File name for file nodes"}
                            },
                            "required": ["id", "type", "description", "x", "y"]
                        }
                    }
                },
                "required": ["nodes"]
            }
        }
    ]
    
    # Store agent configuration
    agent_config = {
        "model": "claude-sonnet-4-5-20250929",
        "tools": tools,
        "system": """You are a node generation assistant for a visual development environment. Your role is to analyze conversation history and generate appropriate file nodes for the canvas based on user intent.

Key responsibilities:
- Understand user requests from conversation history
- Identify what files should be created
- Generate file names and descriptions that clearly explain what each file does
- Use the add_nodes_to_metadata tool to actually create nodes

CRITICAL RULES:
1. You MUST ONLY generate file nodes (type: "file")
2. You MUST ONLY generate Python files (.py extension)
3. You do NOT generate process, data, api, or database nodes
4. You do NOT generate code content for nodes
5. Each file node must have:
   - id: Unique identifier (e.g., "node_1", "node_2", etc.)
   - type: MUST be "file"
   - description: Detailed description of what the file does
   - fileName: The file name (MUST end with .py, e.g., "main.py", "utils.py", "config.py")
   - x: X coordinate (100, 200, 300, etc.)
   - y: Y coordinate (100, 200, 300, etc.)

6. fileName and description can be different - description explains what the file does, fileName is the actual file name
7. Check for fileName conflicts - if a fileName already exists, use a different name
8. ALL files must be Python files with .py extension

CRITICAL: When the user asks you to create nodes, you MUST use the add_nodes_to_metadata tool. Do NOT just describe nodes in your response."""
    }
    
    return client, agent_config


def generate_nodes_from_conversation(client, agent_config, conversation_history):
    """
    Generate nodes based on conversation history using Anthropic Agent SDK with tools.
    
    Args:
        client: Anthropic client instance
        agent_config: Agent configuration with tools and system prompt
        conversation_history: List of messages in format [{"role": "user|assistant", "content": "..."}, ...]
    
    Returns:
        List of generated nodes
    """
    try:
        # Load current metadata to provide context
        current_metadata = load_metadata()
        
        # Prepare messages for the agent with context
        messages = []
        
        # Add context about existing nodes
        if current_metadata:
            context_message = f"""Current nodes in the canvas:
{json.dumps(current_metadata, indent=2)}

Please analyze the user's request and generate NEW nodes. Do NOT duplicate existing nodes."""
            messages.append({"role": "user", "content": context_message})
        
        for msg in conversation_history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        
        # Send message to Anthropic with tools
        response = client.messages.create(
            model=agent_config["model"],
            max_tokens=4000,
            system=agent_config["system"],
            tools=agent_config["tools"],
            messages=messages
        )
        
        # Process the response and handle tool calls
        generated_nodes = None
        assistant_message = ""
        tool_results = []
        
        for content_block in response.content:
            if content_block.type == "text":
                assistant_message += content_block.text
            elif content_block.type == "tool_use":
                # Handle tool calls
                tool_name = content_block.name
                tool_input = content_block.input
                
                if tool_name == "add_nodes_to_metadata":
                    # Execute the tool
                    result = add_nodes_to_metadata(tool_input.get("nodes", []))
                    print(f"Tool result: {result}")
                    if result.get("success"):
                        generated_nodes = tool_input.get("nodes", [])
                    
                    # Add tool result to messages for Anthropic
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": content_block.id,
                        "content": str(result)
                    })
                elif tool_name == "get_metadata":
                    # Execute the tool
                    result = get_metadata()
                    print(f"Metadata retrieved: {len(result)} nodes")
                    
                    # Add tool result to messages for Anthropic
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": content_block.id,
                        "content": str(result)
                    })
        
        # If there are tool results, send them back to Anthropic
        if tool_results:
            messages.append({
                "role": "assistant",
                "content": response.content
            })
            messages.append({
                "role": "user",
                "content": tool_results
            })
            
            # Get the final response
            final_response = client.messages.create(
                model=agent_config["model"],
                max_tokens=4000,
                system=agent_config["system"],
                tools=agent_config["tools"],
                messages=messages
            )
            
            # Extract any text from final response
            for content_block in final_response.content:
                if content_block.type == "text":
                    assistant_message += content_block.text
        
        # If nodes were generated via tool, return them
        if generated_nodes:
            return generated_nodes
        
        # Otherwise, try to parse JSON from the assistant message
        try:
            import re
            json_match = re.search(r'\[.*\]', assistant_message, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass
        return None
    except Exception as e:
        print(f"Error generating nodes: {e}")
        import traceback
        traceback.print_exc()
        return None