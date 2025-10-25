"""
Workspace and terminal management functionality.
"""
import os
from typing import Optional, List, Dict, Any

from fastapi import HTTPException

from config import CANVAS_DIR


class WorkspaceManager:
    """Manage workspaces in canvas/ directory"""
    
    def __init__(self, canvas_dir: str = None):
        if canvas_dir is None:
            # Default to parent directory's canvas/ folder (nody/canvas/)
            canvas_dir = CANVAS_DIR
        self.canvas_dir = os.path.abspath(canvas_dir)  # Make absolute path
        os.makedirs(self.canvas_dir, exist_ok=True)
        self.active_workspace: Optional[str] = self.canvas_dir
        print(f"DEBUG: WorkspaceManager initialized with canvas_dir: {self.canvas_dir}")
        print(f"DEBUG: Active workspace set to: {self.active_workspace}")
    
    def get_active_workspace(self) -> Optional[str]:
        """Get current active workspace path"""
        return self.active_workspace
    
    def set_active_workspace(self, workspace_name: str) -> Dict[str, Any]:
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
    
    def list_workspaces(self) -> List[Dict[str, Any]]:
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
    
    def ensure_active_workspace(self) -> Dict[str, Any]:
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


class TerminalExecutor:
    """Execute terminal commands - ANY command allowed, no restrictions"""
    
    @staticmethod
    def execute(command: str, workspace_path: str, timeout: int = 30) -> Dict[str, Any]:
        """
        Execute ANY command in the workspace directory.
        
        Key Point: All commands run in backend/canvas/workspace/ ONLY
        
        Args:
            command: Any shell command (git, npm, python, etc.)
            workspace_path: Must be inside backend/canvas/
            timeout: Max execution time
        
        Returns:
            dict with success, stdout, stderr, return_code
        """
        import subprocess
        
        try:
            # SECURITY: Ensure workspace is in canvas directory
            if 'canvas' not in workspace_path:
                return {
                    "success": False,
                    "error": "Workspace must be in canvas directory",
                    "stdout": "",
                    "stderr": "",
                    "return_code": -1
                }
            
            # Execute command in workspace directory
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                cwd=workspace_path,  # ← Runs ONLY in workspace
                timeout=timeout
            )
            
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "return_code": result.returncode,
                "workspace": workspace_path  # Return workspace info
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": f"Command timeout (>{timeout}s)",
                "stdout": "",
                "stderr": "",
                "return_code": -1
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "stdout": "",
                "stderr": "",
                "return_code": -1
            }


class WorkspaceService:
    """Service for managing workspaces and terminal operations."""
    
    def __init__(self):
        self.workspace_manager = WorkspaceManager()
        self.terminal_executor = TerminalExecutor()
    
    def list_workspaces(self) -> Dict[str, Any]:
        """List all workspaces in canvas directory"""
        workspaces = self.workspace_manager.list_workspaces()
        active = self.workspace_manager.get_active_workspace()
        
        return {
            "workspaces": workspaces,
            "active_workspace": active
        }
    
    def set_active_workspace(self, workspace_name: str) -> Dict[str, Any]:
        """Set active workspace"""
        result = self.workspace_manager.set_active_workspace(workspace_name)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    
    def get_active_workspace(self) -> Dict[str, Any]:
        """Get active workspace"""
        # Ensure active workspace is set (auto-selects first workspace if needed)
        workspace_info = self.workspace_manager.ensure_active_workspace()
        if not workspace_info["success"]:
            return {"workspace": None}
        return {"workspace": workspace_info["workspace"]}
    
    def execute_terminal_command(self, command: str) -> Dict[str, Any]:
        """
        Execute ANY terminal command in workspace.
        
        CRITICAL: Command executes ONLY in backend/canvas/workspace/
        """
        # Get workspace
        workspace_info = self.workspace_manager.ensure_active_workspace()
        if not workspace_info["success"]:
            raise HTTPException(status_code=400, detail=workspace_info["error"])
        
        workspace_path = workspace_info["workspace"]
        
        # Execute command in workspace
        result = self.terminal_executor.execute(command, workspace_path)
        
        # If command was git clone, update active workspace
        if command.startswith("git clone"):
            # Extract repo name from clone command
            # git clone https://github.com/user/repo.git
            parts = command.split()
            if len(parts) >= 3:
                repo_url = parts[-1]  # Last part is the URL
                repo_name = repo_url.split('/')[-1].replace('.git', '')
                # Auto-set as active workspace
                self.workspace_manager.set_active_workspace(repo_name)
        
        return result


# Global instance
workspace_service = WorkspaceService()
