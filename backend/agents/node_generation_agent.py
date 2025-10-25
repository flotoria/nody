"""
Node Generation Agent - Generates nodes based on conversation history using Letta SDK.
"""

import os
from typing import Dict, Any, List
from dotenv import load_dotenv
from letta_client import Letta

# Import json for use in this module
import json as json_module

# Load environment variables
load_dotenv()

# Path to metadata.json - go up from backend/agents to backend, then to root, then into canvas
METADATA_PATH = "/home/ryan/dev/nody/canvas/metadata.json"
print(f"METADATA_PATH set to: {METADATA_PATH}")

def load_metadata() -> Dict[str, Any]:
    """Load metadata from metadata.json file."""
    if not os.path.exists(METADATA_PATH):
        return {}
    try:
        with open(METADATA_PATH, 'r', encoding='utf-8') as f:
            return json_module.load(f)
    except Exception as e:
        print(f"Error loading metadata: {e}")
        return {}

def save_metadata(metadata: Dict[str, Any]) -> bool:
    """Save metadata to metadata.json file."""
    try:
        os.makedirs(os.path.dirname(METADATA_PATH), exist_ok=True)
        with open(METADATA_PATH, 'w', encoding='utf-8') as f:
            json_module.dump(metadata, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving metadata: {e}")
        return False

def add_nodes_to_metadata(nodes: list) -> Dict[str, Any]:
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
        Dict with success status and message
    """
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
        metadata = load_metadata()
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
                node_data["fileName"] = node["fileName"]
            
            metadata[node_id] = node_data
            print(f"Added node {node_id} to metadata")
        
        # Save metadata
        if save_metadata(metadata):
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

def get_metadata() -> Dict[str, Any]:
    """
    Get the current metadata from the canvas.
    
    Returns:
        Dict containing all current node metadata
    """
    return load_metadata()


def create_node_generation_agent():
    """
    Create a Letta agent for generating nodes based on conversation history.
    
    This agent:
    - Analyzes conversation history to understand user intent
    - Generates appropriate file nodes
    - Creates node descriptions
    - Uses tools to add nodes to metadata
    
    Returns:
        tuple: (Letta client, agent instance)
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
    
    # Create custom tools from our functions
    tools = [
        client.tools.create_from_function(func=get_metadata),
        client.tools.create_from_function(func=add_nodes_to_metadata),
    ]
    
    # Create agent with memory blocks and tools
    agent = client.agents.create(
        memory_blocks=[
            {
                "label": "persona",
                "value": """You are a node generation assistant for a visual development environment. Your role is to analyze conversation history and generate appropriate file nodes for the canvas based on user intent.

Key responsibilities:
- Understand user requests from conversation history
- Identify what files should be created
- Generate file names and descriptions that clearly explain what each file does
- ALWAYS use the add_nodes_to_metadata tool when creating nodes

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

CRITICAL WORKFLOW:
1. When user asks for files/nodes, IMMEDIATELY call add_nodes_to_metadata tool
2. Pass an array of node objects with the required fields
3. Do NOT just describe nodes - actually create them using the tool
4. After creating nodes, provide a summary of what was created

EXAMPLE: If user says "I need a login system", call add_nodes_to_metadata with:
[
  {
    "id": "auth_py",
    "type": "file", 
    "description": "Handles user authentication with login/logout functionality",
    "fileName": "auth.py",
    "x": 100,
    "y": 100
  }
]"""
            },
            {
                "label": "human",
                "value": "The user is a developer working on a project called 'nody' with both frontend and backend components. They need assistance with generating appropriate file nodes based on their conversation."
            },
            {
                "label": "project_context",
                "value": """Current project structure:
- /home/ryan/dev/nody/ - Project root
- /home/ryan/dev/nody/backend/ - Python backend with Letta agent
- /home/ryan/dev/nody/frontend/ - Next.js frontend

The backend uses Letta for AI-powered node generation and the frontend is a Next.js application.""",
                "description": "Stores information about the current project structure and context"
            }
        ],
        tools=[tool.name for tool in tools],
        model="openai/gpt-4o-mini",  # Using cost-effective model
        embedding="openai/text-embedding-3-small"
    )
    
    print(f"Created node generation agent with ID: {agent.id}")
    print(f"Agent has {len(tools)} custom tools")
    
    return client, agent


def generate_nodes_from_conversation(client, agent, conversation_history):
    """
    Generate nodes based on conversation history using Letta SDK with tools.
    
    Args:
        client: Letta client instance
        agent: Letta agent instance
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
        
        for i, msg in enumerate(conversation_history):
            # Letta might not accept "assistant" messages in conversation history
            # Convert all messages to "user" role for the agent
            print(f"Processing message with role: {msg['role']}")
            content = msg["content"]
            
            # Add explicit JSON output instruction only to the last message
            if i == len(conversation_history) - 1:
                content = f"""{content}

IMPORTANT: Your response must include a JSON array of nodes at the end.
Example format:
```json
[
  {{"id": "node_1", "type": "file", "description": "Test node", "x": 100, "y": 100, "fileName": "test.py"}},
  {{"id": "node_2", "type": "file", "description": "Another test node", "x": 200, "y": 100, "fileName": "test2.py"}}
]
```"""
            
            messages.append({"role": "user", "content": content})
        
        print(f"Final messages being sent: {[m['role'] for m in messages]}")
        
        print(f"Sending {len(messages)} messages to Letta agent")
        
        # Send message to Letta agent (Letta handles tool execution automatically)
        response = client.agents.messages.create(
            agent_id=agent.id,
            messages=messages
        )
        
        print(f"Received response with {len(response.messages)} messages")
        
        # Process the response - Letta automatically executes tools and includes results
        generated_nodes_list = []
        assistant_message = ""
        
        print(f"\n=== PROCESSING {len(response.messages)} MESSAGES ===")
        print(f"Response object type: {type(response)}")
        print(f"Response object: {response}")
        
        for i, msg in enumerate(response.messages):
            print(f"\n--- Message {i+1}/{len(response.messages)} ---")
            print(f"Type: {msg.message_type}")
            print(f"Message object type: {type(msg)}")
            print(f"Full message object: {msg}")
            
            # Try to print all attributes
            if hasattr(msg, '__dict__'):
                print(f"Message attributes: {msg.__dict__}")
            
            if msg.message_type == "assistant_message" and msg.content:
                assistant_message += msg.content
                # Try to parse nodes from the message content
                print(f"Assistant message content: {msg.content}")
                
                # Try to extract node information from the message
                # Look for node IDs and other details
                import re
                node_ids = re.findall(r'`(\w+_node_\d+)`|node ID[:\s]+`?(\w+_node_\d+)`?|Node ID[:\s]+`?(\w+_\d+)`?', msg.content, re.IGNORECASE)
                filenames = re.findall(r'File Name[:\s]+`?([\w\.]+)`?', msg.content, re.IGNORECASE)
                coords = re.findall(r'\((\d+),\s*(\d+)\)', msg.content)
                
                if node_ids or filenames:
                    print(f"Found node IDs: {node_ids}, filenames: {filenames}, coords: {coords}")
                    # Extract unique node IDs
                    unique_ids = list(set([item for sublist in node_ids for item in sublist if item]))
                    if unique_ids or filenames:
                        nodes = []
                        for i, node_id in enumerate(unique_ids):
                            if node_id:
                                coord_x = float(coords[i][0]) if i < len(coords) else 100.0
                                coord_y = float(coords[i][1]) if i < len(coords) else 100.0
                                filename = filenames[i] if i < len(filenames) else f"{node_id}.py"
                                nodes.append({
                                    "id": node_id,
                                    "type": "file",
                                    "description": f"Generated node: {filename}",
                                    "x": coord_x,
                                    "y": coord_y,
                                    "fileName": filename
                                })
                        if nodes:
                            print(f"Parsed {len(nodes)} nodes from message")
                            generated_nodes_list = nodes
            elif msg.message_type == "tool_call_message" and msg.tool_call:
                # Tool was called
                tool_name = msg.tool_call.name
                tool_args = msg.tool_call.arguments
                print(f"\n=== TOOL CALL DETECTED ===")
                print(f"Tool name: {tool_name}")
                print(f"Tool args type: {type(tool_args)}, value: {tool_args}")
                
                # Parse tool arguments (may be string or dict)
                if isinstance(tool_args, str):
                    import json
                    tool_args = json.loads(tool_args)
                
                # Execute locally
                if tool_name == "add_nodes_to_metadata":
                    print(f"Executing tool locally...")
                    try:
                        nodes_arg = tool_args.get("nodes", [])
                        result = add_nodes_to_metadata(nodes_arg)
                        if result.get("success") and "parsed_nodes" in result:
                            generated_nodes_list = result["parsed_nodes"]
                            print(f"Saved {len(generated_nodes_list)} nodes to metadata.json")
                            # Override assistant message to avoid error reporting
                            assistant_message = f"Successfully created {len(generated_nodes_list)} nodes."
                    except Exception as e:
                        print(f"Error: {e}")
                        import traceback
                        traceback.print_exc()
            elif msg.message_type == "tool_return_message":
                # Tool result returned (Letta handles this automatically)
                tool_result = msg.tool_return
                print(f"Tool returned (type: {type(tool_result)}): {tool_result}")
                
                # If we already executed the tool locally successfully, ignore the sandbox error
                if generated_nodes_list:
                    print("Tool already executed locally, ignoring sandbox result")
                    continue
                
                # Try to access the result data
                if hasattr(tool_result, 'data'):
                    print(f"Tool result has 'data' attribute: {tool_result.data}")
                if hasattr(tool_result, 'result'):
                    print(f"Tool result has 'result' attribute: {tool_result.result}")
                
                # Check if add_nodes_to_metadata was called and successful
                if isinstance(tool_result, dict) and tool_result.get("success"):
                    print(f"Tool was successful. Keys: {tool_result.keys()}")
                    if "parsed_nodes" in tool_result:
                        parsed_nodes = tool_result["parsed_nodes"]
                        print(f"Got {len(parsed_nodes)} parsed nodes from tool")
                        generated_nodes_list = parsed_nodes
                elif isinstance(tool_result, dict):
                    # Try all possible keys
                    print(f"Tool result keys: {tool_result.keys()}")
                    for key, value in tool_result.items():
                        print(f"  {key}: {value}")
                else:
                    # Try to stringify and parse
                    print(f"Raw result: {tool_result}")
                    try:
                        import json
                        result_str = str(tool_result)
                        if result_str and result_str != "None":
                            print(f"Trying to parse as JSON...")
                    except Exception as e:
                        print(f"Could not parse tool result: {e}")
        
        # If nodes were generated, ask for a summary
        if generated_nodes_list:
            print("Nodes were generated, asking for summary...")
            
            # Create a summary request
            summary_messages = messages + [{
                "role": "user", 
                "content": "Please provide a clear summary of what nodes you just created and what they do. Be specific about the file names and their purposes."
            }]
            
            # Get summary response
            summary_response = client.agents.messages.create(
                agent_id=agent.id,
                messages=summary_messages
            )
            
            # Extract the summary message
            summary_message = ""
            for msg in summary_response.messages:
                if msg.message_type == "assistant_message" and msg.content:
                    summary_message += msg.content
            
            # Use the summary as the assistant message
            if summary_message:
                assistant_message = summary_message
                print(f"Got summary: {summary_message[:100]}...")
        
        # If nodes were generated via tool, return them with message
        if generated_nodes_list:
            # Give a positive message when nodes are successfully created
            assistant_message = f"Successfully created {len(generated_nodes_list)} nodes. The following files have been added to your canvas:\n"
            for node in generated_nodes_list:
                assistant_message += f"- **{node.get('fileName', 'unknown')}**: {node.get('description', '')}\n"
            return generated_nodes_list, assistant_message
        
        # Otherwise, try to parse JSON from the assistant message
        try:
            import re
            import json as json_parser
            json_match = re.search(r'\[.*\]', assistant_message, re.DOTALL)
            if json_match:
                parsed_nodes = json_parser.loads(json_match.group())
                if parsed_nodes:
                    return parsed_nodes, f"Successfully created {len(parsed_nodes)} nodes."
        except Exception:
            pass
        return None, assistant_message
    except Exception as e:
        print(f"Error generating nodes: {e}")
        import traceback
        traceback.print_exc()
        return None, f"Error generating nodes: {str(e)}"
