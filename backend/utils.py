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


def generate_default_edges(files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Create a simple set of dependency edges between consecutive files."""
    edges: List[Dict[str, Any]] = []
    if len(files) < 2:
        return edges

    for index in range(len(files) - 1):
        source = files[index]
        target = files[index + 1]
        edges.append({
            "from": source["id"],
            "to": target["id"],
            "type": "depends_on",
            "description": f"{target['label']} builds on outputs from {source['label']}.",
        })
    return edges


def fallback_metadata_plan(project_spec: Dict[str, Any]) -> Dict[str, Any]:
    """Create a deterministic scaffold when the Letta agent does not provide one."""
    features = project_spec.get("primary_features") or []
    goals = project_spec.get("goals") or []
    extension = infer_default_extension(project_spec)

    files: List[Dict[str, Any]] = []

    if features:
        for index, feature in enumerate(features, start=1):
            name = feature.get("name") or f"Feature {index}"
            slug = slugify(name)
            directory = "frontend" if extension in {".tsx", ".ts", ".js", ".jsx"} else "backend"
            file_name = f"{directory}/{slug}{extension}"
            description_parts = [
                f"Implement feature '{name}' using the chosen stack.",
                feature.get("description", ""),
            ]
            criteria = feature.get("acceptance_criteria") or []
            if criteria:
                description_parts.append("Acceptance criteria:")
                description_parts.extend(f"- {item}" for item in criteria)
            if goals:
                description_parts.append("Project goals to consider:")
                description_parts.extend(f"- {goal}" for goal in goals)

            files.append({
                "id": slug,
                "file_name": file_name,
                "label": os.path.basename(file_name),
                "description": "\n".join(part for part in description_parts if part),
            })
    else:
        base_name = slugify(project_spec.get("title", "app"))
        file_name = f"backend/{base_name}{extension}"
        files.append({
            "id": base_name,
            "file_name": file_name,
            "label": os.path.basename(file_name),
            "description": project_spec.get("summary", "Implement the main application entrypoint."),
        })

    edges = generate_default_edges(files)
    return {"files": files, "edges": edges}


def sanitize_plan(plan_data: Dict[str, Any], project_spec: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure the metadata plan contains valid, normalized files and edges."""
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
