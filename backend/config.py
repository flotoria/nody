"""
Configuration settings for the Nody VDE backend.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Project paths
BACKEND_ROOT = Path(__file__).parent
print(f"BACKEND_ROOT: {BACKEND_ROOT}")
CANVAS_ROOT = BACKEND_ROOT.parent / "canvas"
CANVAS_DIR = CANVAS_ROOT / "nodes"
PROJECT_SPEC_PATH = CANVAS_ROOT / "project-spec.json"
EDGES_FILE = CANVAS_ROOT / "edges.json"
METADATA_FILE = CANVAS_ROOT / "metadata.json"
OUTPUT_FILE = CANVAS_ROOT / "output.json"

# Ensure canvas directories exist
CANVAS_ROOT.mkdir(exist_ok=True)
CANVAS_DIR.mkdir(exist_ok=True)

# API Configuration
API_TITLE = "Nody VDE Backend"
API_VERSION = "0.1.0"
CORS_ORIGINS = ["http://localhost:3000"]  # Next.js dev server

# External API Configuration
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

# Letta Configuration
LETTA_API_KEY = os.environ.get("LETTA_API_KEY")
LETTA_BASE_URL = os.environ.get("LETTA_BASE_URL", "http://localhost:8283")

# System Prompts
ONBOARDING_SYSTEM_PROMPT = """
You are Nody's onboarding architect. Your job is to gather the minimum viable specification needed to auto-generate a software project.
Always respond with a JSON object that contains exactly these keys:
- assistant_message (string): what you say to the user. Ask concise follow-up questions when you still need information.
- status (string): either "collecting" or "ready".
- missing_information (array of strings): high-level bullet points describing the remaining information you need. Use an empty array when nothing is missing.
- project_spec (object or null): null while you are still collecting information. When status is "ready", include a complete project specification with the fields shown below.

When status is "ready", project_spec must include:
{
  "title": string,
  "summary": string,
  "goals": [string],
  "target_users": [string],
  "primary_features": [
    {
      "name": string,
      "description": string,
      "acceptance_criteria": [string]
    }
  ],
  "technical_stack": {
    "frontend": string,
    "backend": string,
    "api": string,
    "database": string,
    "infrastructure": string,
    "third_party_services": [string]
  },
  "integrations": [string],
  "non_functional_requirements": [string],
  "constraints": [string],
  "success_metrics": [string],
  "open_questions": [string]
}

Guidelines:
- Never wrap the JSON output in markdown code fences or add commentary outside the JSON.
- While status is "collecting", assistant_message must include at least one targeted follow-up question that helps resolve the highest-priority missing information.
- Once you have enough detail, set status to "ready", ensure missing_information is an empty array, provide the complete project_spec, and summarise the plan in assistant_message.
- If the user clearly signals they are finished (e.g., "done", "build it now", "generate the spec"), stop asking follow-up questions, make reasonable assumptions for any remaining gaps, set status to "ready", clear missing_information, and return the best project_spec you can.
""".strip()

LETTA_METADATA_SYSTEM_PROMPT = """
You are Nody's workspace architect. Using a confirmed project specification, design the canvas workspace.

Respond ONLY with minified JSON (no markdown, no commentary) that includes these keys:
- files: array of objects with fields { "id": string (snake_case), "file_name": string (relative path, include extension), "label": string (short display name), "description": string (detailed implementation guidance) }.
- edges: array of objects with fields { "from": string (file id), "to": string (file id), "type": string (relationship such as "depends_on" or "calls"), "description": string }.

Guidelines:
- Produce 4-12 files covering backend, frontend, configuration, and data/model layers implied by the specification.
- Choose reasonable directories that match the tech stack (e.g., Next.js -> "frontend/app", FastAPI -> "backend/api").
- Descriptions must contain enough details for another agent to implement the file without additional context.
- Edges must connect every file to every other file (a fully connected graph); add directional reasoning in each description so the dependency is clear.
- Keep JSON valid, no trailing commas, no code fences, and no extra keys.
""".strip()

# Canvas Layout Configuration
CANVAS_COLUMNS = 4
CANVAS_X_SPACING = 260
CANVAS_Y_SPACING = 200
CANVAS_MARGIN_X = 160
CANVAS_MARGIN_Y = 140

# File Type Mappings
FILE_TYPE_MAP = {
    '.py': 'python',
    '.js': 'javascript', 
    '.ts': 'typescript',
    '.json': 'json',
    '.html': 'html',
    '.css': 'css',
    '.md': 'markdown',
    '.txt': 'text'
}

# Output Configuration
MAX_OUTPUT_MESSAGES = 100
