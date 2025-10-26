"""
Utility functions for file operations, positioning, and data processing.
"""
import os
import json
from typing import Dict, Any, List, Optional, Tuple


def slugify(value: str) -> str:
    """Convert a string into a filesystem and metadata friendly identifier."""
    cleaned = ''.join(char if char.isalnum() else '_' for char in value.lower())
    cleaned = '_'.join(part for part in cleaned.split('_') if part)
    return cleaned or "node"


def infer_default_extension(project_spec: Dict[str, Any]) -> str:
    """Guess a sensible default file extension based on the declared tech stack."""
    stack = project_spec.get("technical_stack", {})
    combined = " ".join([
        stack.get("frontend", ""),
        stack.get("backend", ""),
        stack.get("api", ""),
        stack.get("infrastructure", ""),
    ]).lower()

    if any(keyword in combined for keyword in ["python", "fastapi", "django", "flask"]):
        return ".py"
    if any(keyword in combined for keyword in ["typescript", "next", "react", "angular"]):
        return ".tsx"
    if "javascript" in combined or "node" in combined or "express" in combined:
        return ".js"
    if "go" in combined:
        return ".go"
    if "java" in combined or "spring" in combined:
        return ".java"
    if "c#" in combined or "dotnet" in combined:
        return ".cs"
    if "swift" in combined:
        return ".swift"
    if "kotlin" in combined:
        return ".kt"
    return ".txt"


def infer_file_type_from_name(file_name: str) -> str:
    """Map a file extension to a FileNode friendly type label."""
    from config import FILE_TYPE_MAP
    
    ext = os.path.splitext(file_name)[1].lower()
    return FILE_TYPE_MAP.get(ext, "text")


def position_for_index(index: int) -> Tuple[float, float]:
    """Create a deterministic position for nodes in a loose grid layout."""
    from config import CANVAS_COLUMNS, CANVAS_X_SPACING, CANVAS_Y_SPACING, CANVAS_MARGIN_X, CANVAS_MARGIN_Y
    
    row = index // CANVAS_COLUMNS
    column = index % CANVAS_COLUMNS
    return CANVAS_MARGIN_X + column * CANVAS_X_SPACING, CANVAS_MARGIN_Y + row * CANVAS_Y_SPACING


def extract_structured_payload(raw_content: str) -> Dict[str, Any]:
    """Parse an assistant response into a structured JSON payload."""
    content = raw_content.strip()
    if content.startswith("```"):
        content = content.strip("`")
        if "\n" in content:
            _, remainder = content.split("\n", 1)
            content = remainder
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail="Assistant response could not be parsed as JSON") from exc


def generate_default_edges(node_files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Create a fully connected set of dependency edges between all node files."""
    edges: List[Dict[str, Any]] = []
    if len(node_files) < 2:
        return edges

    for source in node_files:
        for target in node_files:
            if source["id"] == target["id"]:
                continue
            edges.append({
                "from": source["id"],
                "to": target["id"],
                "type": "depends_on",
                "description": f"{target['label']} consumes outputs from {source['label']} to stay in sync.",
            })
    return edges


def fallback_metadata_plan(project_spec: Dict[str, Any]) -> Dict[str, Any]:
    """Create a deterministic scaffold when the AI agent does not provide one."""
    features = project_spec.get("primary_features") or []
    goals = project_spec.get("goals") or []
    extension = infer_default_extension(project_spec)
    stack = project_spec.get("technical_stack") or {}
    frontend_stack = (stack.get("frontend") or "").lower()
    backend_stack = (stack.get("backend") or "").lower()

    node_files: List[Dict[str, Any]] = []
    title = project_spec.get("title", "App")
    base_slug = slugify(title)

    feature_summaries = []
    feature_acceptance = []
    for feature in features:
        name = feature.get("name") or "Feature"
        summary = feature.get("description") or ""
        feature_summaries.append(f"- {name}: {summary}".strip())
        criteria = feature.get("acceptance_criteria") or []
        for criterion in criteria:
            feature_acceptance.append(f"- {criterion}".strip())

    goal_lines = [f"- {goal}".strip() for goal in goals]

    def join_lines(lines: List[str]) -> str:
        return "\n".join(line for line in lines if line)

    def frontend_extension() -> str:
        if any(keyword in frontend_stack for keyword in ["tsx", "react", "next", "typescript"]):
            return ".tsx"
        if "vue" in frontend_stack:
            return ".vue"
        if "svelte" in frontend_stack:
            return ".svelte"
        return ".js"

    def backend_extension() -> str:
        if any(keyword in backend_stack for keyword in ["python", "fastapi", "flask", "django"]):
            return ".py"
        if any(keyword in backend_stack for keyword in ["typescript", "node", "express"]):
            return ".ts"
        if "javascript" in backend_stack:
            return ".js"
        if "go" in backend_stack:
            return ".go"
        if "java" in backend_stack:
            return ".java"
        return extension

    if frontend_stack:
        front_ext = frontend_extension()
        primary_feature = features[0] if features else {}
        primary_feature_name = primary_feature.get("name", title)
        feature_description = primary_feature.get("description", "")

        node_files.append({
            "id": f"{base_slug}_frontend_page",
            "file_name": f"frontend/app/{base_slug}/page{front_ext}",
            "label": f"{title} Page",
            "description": "\n".join(filter(None, [
                f"Top-level {primary_feature_name.lower()} interface built with {stack.get('frontend', 'the frontend stack')}.",
                feature_description,
                "Primary features:",
                join_lines(feature_summaries),
                "Acceptance criteria:",
                join_lines(feature_acceptance),
                "Project goals:",
                join_lines(goal_lines),
                "Connect to the frontend API client for persistence.",
            ])),
        })

        node_files.append({
            "id": f"{base_slug}_canvas_component",
            "file_name": f"frontend/components/{base_slug}_canvas{front_ext}",
            "label": f"{primary_feature_name} Component",
            "description": "\n".join(filter(None, [
                f"Encapsulates the interactive canvas for {primary_feature_name.lower()}.",
                "Expose props for selected color, stroke width, and callbacks for draw/save events.",
                "Emit drawing data to the API client using hooks so the backend can persist PNG exports.",
                "Keep the UI accessible for young users (keyboard shortcuts optional, large touch targets).",
            ])),
        })

        node_files.append({
            "id": f"{base_slug}_frontend_api",
            "file_name": f"frontend/lib/{base_slug}_api.ts",
            "label": "Frontend API Client",
            "description": "\n".join(filter(None, [
                "Client-side wrapper for calling the drawing REST endpoints.",
                "Expose functions to save drawings, retrieve saved artworks, and manage session metadata.",
                "Handle optimistic updates and graceful fallbacks when the backend is offline.",
            ])),
        })

    if features:
        for index, feature in enumerate(features, start=1):
            feature_slug = slugify(feature.get("name") or f"feature_{index}")
            if backend_stack:
                back_ext = backend_extension()
                node_files.append({
                    "id": f"{feature_slug}_api",
                    "file_name": f"backend/api/{feature_slug}_routes{back_ext}",
                    "label": f"{feature.get('name', 'Feature')} API",
                    "description": "\n".join(filter(None, [
                        f"REST endpoints for the {feature.get('name', '').lower()} functionality.",
                        feature.get("description", ""),
                        "Implement POST endpoint to persist drawing data and GET endpoint to list saved art.",
                        "Validate input payloads, handle storage (local filesystem or in-memory), and return meaningful errors.",
                    ])),
                })
                node_files.append({
                    "id": f"{feature_slug}_service",
                    "file_name": f"backend/services/{feature_slug}_service{back_ext}",
                    "label": f"{feature.get('name', 'Feature')} Service",
                    "description": "\n".join(filter(None, [
                        "Business logic for processing drawing commands:",
                        "- Normalize stroke data and colors before persistence.",
                        "- Coordinate image export to PNG using a pillow/canvas helper module.",
                        "- Provide utility helpers for the API layer.",
                    ])),
                })

        if backend_stack:
            back_ext = backend_extension()
            node_files.append({
                "id": f"{base_slug}_storage",
                "file_name": f"backend/storage/{base_slug}_store{back_ext}",
                "label": "Storage Integration",
                "description": "\n".join(filter(None, [
                    "Abstraction over persistence (local filesystem now, extensible to cloud storage later).",
                    "Expose save_drawing, list_drawings, and load_drawing helpers used by services and APIs.",
                    "Handle the directory structure, file naming, and basic retention policy.",
                ])),
            })
            node_files.append({
                "id": f"{base_slug}_schema",
                "file_name": f"backend/schemas/{base_slug}_schema{back_ext}",
                "label": "Request/Response Schemas",
                "description": "\n".join(filter(None, [
                    "Pydantic (or equivalent) models defining request payloads and responses for drawing endpoints.",
                    "Include validation for brush size, color hex codes, and drawing metadata (title, created_at).",
                    "Reuse schema definitions in both API routes and services to stay type-safe.",
                ])),
            })

    if not node_files:
        base_name = base_slug
        file_name = f"backend/{base_name}{extension}"
        node_files.append({
            "id": base_name,
            "file_name": file_name,
            "label": os.path.basename(file_name),
            "description": project_spec.get("summary", "Implement the main application entrypoint."),
        })

    launcher_present = any(entry.get("file_name") == "scripts/run_app.sh" for entry in node_files)
    if not launcher_present:
        node_files.append({
            "id": f"{base_slug}_launcher",
            "file_name": "scripts/run_app.sh",
            "label": "Run App Script",
            "description": "\n".join([
                "Shell script that boots both FastAPI backend (uvicorn) and Next.js frontend dev server.",
                "Ensure POSIX compatibility: use `bash` or WSL on Windows.",
                "Start backend in virtualenv if available, then frontend via npm/pnpm/yarn. Clean up both on exit.",
            ]),
        })

    edges = generate_default_edges(node_files)
    return {"files": node_files, "edges": edges}


def sanitize_plan(plan_data: Dict[str, Any], project_spec: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure the metadata plan contains valid, normalized node files and edges."""
    raw_files = plan_data.get("files")
    if not isinstance(raw_files, list) or not raw_files:
        return fallback_metadata_plan(project_spec)

    sanitized_files: List[Dict[str, Any]] = []
    id_map: Dict[str, str] = {}
    used_ids: Dict[str, int] = {}
    default_extension = infer_default_extension(project_spec)

    for entry in raw_files:
        if not isinstance(entry, dict):
            continue

        raw_file_name = entry.get("file_name") or entry.get("path") or entry.get("name") or entry.get("label")
        if not raw_file_name:
            continue

        file_name = raw_file_name.strip().replace("\\", "/")
        if not file_name:
            continue

        if not os.path.splitext(os.path.basename(file_name))[1]:
            file_name = f"{file_name}{default_extension}"

        normalized_path = os.path.normpath(file_name).replace("\\", "/")
        if normalized_path.startswith(".."):
            continue

        base_id_source = entry.get("id") or os.path.splitext(os.path.basename(normalized_path))[0]
        node_id = slugify(str(base_id_source))
        if node_id in used_ids:
            used_ids[node_id] += 1
            node_id = f"{node_id}_{used_ids[node_id]}"
        else:
            used_ids[node_id] = 1

        label = entry.get("label") or os.path.basename(normalized_path)
        description = entry.get("description") or project_spec.get("summary", "")

        sanitized_files.append({
            "id": node_id,
            "file_name": normalized_path,
            "label": label,
            "description": description,
        })

        for key in {
            entry.get("id"),
            raw_file_name,
            normalized_path,
            os.path.basename(normalized_path),
            node_id,
        }:
            if key:
                id_map[str(key).lower()] = node_id

    if not sanitized_files:
        return fallback_metadata_plan(project_spec)

    label_map = {file["id"]: file["label"] for file in sanitized_files}

    raw_edges = plan_data.get("edges")
    sanitized_edges: List[Dict[str, Any]] = []
    if isinstance(raw_edges, list):
        for entry in raw_edges:
            if not isinstance(entry, dict):
                continue
            raw_from = entry.get("from") or entry.get("source")
            raw_to = entry.get("to") or entry.get("target")
            if not raw_from or not raw_to:
                continue

            from_id = id_map.get(str(raw_from).lower())
            to_id = id_map.get(str(raw_to).lower())
            if not from_id or not to_id or from_id == to_id:
                continue

            edge_type = entry.get("type") or "depends_on"
            description = entry.get("description") or f"{label_map[from_id]} interacts with {label_map[to_id]}."
            sanitized_edges.append({
                "from": from_id,
                "to": to_id,
                "type": edge_type,
                "description": description,
            })

    if not sanitized_edges:
        sanitized_edges = generate_default_edges(sanitized_files)

    return {"files": sanitized_files, "edges": sanitized_edges}
