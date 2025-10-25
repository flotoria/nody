import subprocess
from typing import Optional

class TerminalExecutor:
    """Execute terminal commands - ANY command allowed, no restrictions"""
    
    @staticmethod
    def execute(command: str, workspace_path: str, timeout: int = 30) -> dict:
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
