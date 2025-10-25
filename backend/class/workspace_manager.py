import os
from pathlib import Path
from typing import Optional, List

class WorkspaceManager:
    """Manage workspaces in canvas/ directory"""
    
    def __init__(self, canvas_dir: str = None):
        if canvas_dir is None:
            # Default to parent directory's canvas/ folder (nody/canvas/)
            canvas_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "canvas")
        self.canvas_dir = canvas_dir
        os.makedirs(canvas_dir, exist_ok=True)
        self.active_workspace: Optional[str] = None
    
    def get_active_workspace(self) -> Optional[str]:
        """Get current active workspace path"""
        return self.active_workspace
    
    def set_active_workspace(self, workspace_name: str) -> dict:
        """
        Set active workspace by name.
        Workspace must exist in backend/canvas/
        """
        workspace_path = os.path.join(self.canvas_dir, workspace_name)
        
        if not os.path.exists(workspace_path):
            return {
                "success": False,
                "error": f"Workspace '{workspace_name}' not found in canvas/"
            }
        
        self.active_workspace = workspace_path
        return {
            "success": True,
            "workspace": workspace_path,
            "name": workspace_name
        }
    
    def list_workspaces(self) -> List[dict]:
        """List all workspaces in canvas directory"""
        workspaces = []
        
        if not os.path.exists(self.canvas_dir):
            return workspaces
        
        for item in os.listdir(self.canvas_dir):
            workspace_path = os.path.join(self.canvas_dir, item)
            if os.path.isdir(workspace_path):
                has_git = os.path.exists(os.path.join(workspace_path, '.git'))
                workspaces.append({
                    "name": item,
                    "path": workspace_path,
                    "has_git": has_git
                })
        
        return workspaces
    
    def ensure_active_workspace(self) -> dict:
        """Ensure there's an active workspace"""
        if self.active_workspace:
            return {"success": True, "workspace": self.active_workspace}
        
        # Auto-select first workspace if exists
        workspaces = self.list_workspaces()
        print(f"DEBUG: Found {len(workspaces)} workspaces: {workspaces}")
        if workspaces:
            self.active_workspace = workspaces[0]["path"]
            print(f"DEBUG: Auto-selected workspace: {self.active_workspace}")
            return {"success": True, "workspace": self.active_workspace}
        
        print(f"DEBUG: No workspaces found in {self.canvas_dir}")
        return {
            "success": False,
            "error": "No active workspace. Clone a repository first using: git clone <repo-url>"
        }
