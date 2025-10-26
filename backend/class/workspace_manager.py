import os
import tempfile
from pathlib import Path
from typing import Optional, List

class WorkspaceManager:
    """Manage workspaces in canvas/ directory"""
    
    def __init__(self, git_dir: str = None):
        if git_dir is None:
            # Default to parent directory's git/ folder (nody/canvas/)
            git_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "canvas")
        self.git_dir = os.path.abspath(git_dir)  # Make absolute path
        os.makedirs(self.git_dir, exist_ok=True)
        self.active_workspace: Optional[str] = None  # Start with no active workspace
        self.temp_workspace: Optional[str] = None  # Temporary isolated workspace
        print(f"DEBUG: WorkspaceManager initialized with git_dir: {self.git_dir}")
        print(f"DEBUG: Active workspace set to: {self.active_workspace}")
    
    def get_active_workspace(self) -> Optional[str]:
        """Get current active workspace path"""
        return self.active_workspace
    
    def set_active_workspace(self, workspace_name: str) -> dict:
        """
        Set active workspace by name.
        Workspace must exist in canvas/
        """
        workspace_path = os.path.join(self.git_dir, workspace_name)
        
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
        """List all workspaces in git directory"""
        workspaces = []
        
        if not os.path.exists(self.git_dir):
            return workspaces
        
        for item in os.listdir(self.git_dir):
            workspace_path = os.path.join(self.git_dir, item)
            if os.path.isdir(workspace_path):
                has_git = os.path.exists(os.path.join(workspace_path, '.git'))
                workspaces.append({
                    "name": item,
                    "path": workspace_path,
                    "has_git": has_git
                })
        
        return workspaces
    
    def ensure_active_workspace(self, command: str = None) -> dict:
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
        
        # Create a temporary isolated workspace to prevent git tracking
        if not self.temp_workspace:
            self.temp_workspace = tempfile.mkdtemp(prefix="nody_terminal_")
            print(f"DEBUG: Created temporary isolated workspace: {self.temp_workspace}")
        
        print(f"DEBUG: No workspaces found, using temporary isolated workspace: {self.temp_workspace}")
        return {"success": True, "workspace": self.temp_workspace}