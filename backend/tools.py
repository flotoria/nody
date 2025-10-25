"""
Custom file system tools for the Letta agent.
These tools provide comprehensive file operations capabilities.
"""

import os
import json
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional


def read_file(file_path: str) -> str:
    """
    Read the contents of a file.
    
    Args:
        file_path (str): Path to the file to read
        
    Returns:
        str: Contents of the file
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return f"Error: File '{file_path}' not found"
    except PermissionError:
        return f"Error: Permission denied reading '{file_path}'"
    except Exception as e:
        return f"Error reading file '{file_path}': {str(e)}"


def write_file(file_path: str, content: str, create_dirs: bool = True) -> str:
    """
    Write content to a file.
    
    Args:
        file_path (str): Path to the file to write
        content (str): Content to write to the file
        create_dirs (bool): Whether to create parent directories if they don't exist
        
    Returns:
        str: Success message or error
    """
    try:
        if create_dirs:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"Successfully wrote {len(content)} characters to '{file_path}'"
    except PermissionError:
        return f"Error: Permission denied writing to '{file_path}'"
    except Exception as e:
        return f"Error writing file '{file_path}': {str(e)}"


def delete_file(file_path: str) -> str:
    """
    Delete a file.
    
    Args:
        file_path (str): Path to the file to delete
        
    Returns:
        str: Success message or error
    """
    try:
        if os.path.isfile(file_path):
            os.remove(file_path)
            return f"Successfully deleted file '{file_path}'"
        elif os.path.isdir(file_path):
            return f"Error: '{file_path}' is a directory. Use delete_directory to remove directories."
        else:
            return f"Error: File '{file_path}' not found"
    except PermissionError:
        return f"Error: Permission denied deleting '{file_path}'"
    except Exception as e:
        return f"Error deleting file '{file_path}': {str(e)}"


def delete_directory(dir_path: str, recursive: bool = False) -> str:
    """
    Delete a directory.
    
    Args:
        dir_path (str): Path to the directory to delete
        recursive (bool): Whether to delete directory and all contents recursively
        
    Returns:
        str: Success message or error
    """
    try:
        if not os.path.exists(dir_path):
            return f"Error: Directory '{dir_path}' not found"
        
        if not os.path.isdir(dir_path):
            return f"Error: '{dir_path}' is not a directory"
        
        if recursive:
            shutil.rmtree(dir_path)
            return f"Successfully deleted directory '{dir_path}' and all contents"
        else:
            os.rmdir(dir_path)
            return f"Successfully deleted empty directory '{dir_path}'"
    except PermissionError:
        return f"Error: Permission denied deleting '{dir_path}'"
    except OSError as e:
        if "not empty" in str(e):
            return f"Error: Directory '{dir_path}' is not empty. Use recursive=True to delete non-empty directories."
        return f"Error deleting directory '{dir_path}': {str(e)}"
    except Exception as e:
        return f"Error deleting directory '{dir_path}': {str(e)}"


def list_files(directory_path: str = ".", recursive: bool = False, show_hidden: bool = False) -> str:
    """
    List files and directories in a directory.
    
    Args:
        directory_path (str): Path to the directory to list
        recursive (bool): Whether to list files recursively
        show_hidden (bool): Whether to show hidden files (starting with .)
        
    Returns:
        str: Formatted list of files and directories
    """
    try:
        if not os.path.exists(directory_path):
            return f"Error: Directory '{directory_path}' not found"
        
        if not os.path.isdir(directory_path):
            return f"Error: '{directory_path}' is not a directory"
        
        files = []
        dirs = []
        
        if recursive:
            for root, directories, filenames in os.walk(directory_path):
                # Filter hidden files/dirs if needed
                if not show_hidden:
                    directories[:] = [d for d in directories if not d.startswith('.')]
                    filenames = [f for f in filenames if not f.startswith('.')]
                
                for filename in filenames:
                    file_path = os.path.join(root, filename)
                    files.append(file_path)
                
                for directory in directories:
                    dir_path = os.path.join(root, directory)
                    dirs.append(dir_path)
        else:
            items = os.listdir(directory_path)
            if not show_hidden:
                items = [item for item in items if not item.startswith('.')]
            
            for item in items:
                item_path = os.path.join(directory_path, item)
                if os.path.isdir(item_path):
                    dirs.append(item_path)
                else:
                    files.append(item_path)
        
        result = f"Contents of '{directory_path}':\n\n"
        
        if dirs:
            result += "Directories:\n"
            for d in sorted(dirs):
                result += f"  📁 {d}\n"
            result += "\n"
        
        if files:
            result += "Files:\n"
            for f in sorted(files):
                size = os.path.getsize(f) if os.path.exists(f) else 0
                result += f"  📄 {f} ({size} bytes)\n"
        
        if not dirs and not files:
            result += "Directory is empty"
        
        return result
        
    except PermissionError:
        return f"Error: Permission denied accessing '{directory_path}'"
    except Exception as e:
        return f"Error listing directory '{directory_path}': {str(e)}"


def create_directory(dir_path: str, parents: bool = True) -> str:
    """
    Create a directory.
    
    Args:
        dir_path (str): Path to the directory to create
        parents (bool): Whether to create parent directories if they don't exist
        
    Returns:
        str: Success message or error
    """
    try:
        if parents:
            os.makedirs(dir_path, exist_ok=True)
        else:
            os.mkdir(dir_path)
        return f"Successfully created directory '{dir_path}'"
    except FileExistsError:
        return f"Error: Directory '{dir_path}' already exists"
    except PermissionError:
        return f"Error: Permission denied creating '{dir_path}'"
    except Exception as e:
        return f"Error creating directory '{dir_path}': {str(e)}"


def copy_file(source_path: str, destination_path: str, create_dirs: bool = True) -> str:
    """
    Copy a file to a new location.
    
    Args:
        source_path (str): Path to the source file
        destination_path (str): Path to the destination
        create_dirs (bool): Whether to create parent directories if they don't exist
        
    Returns:
        str: Success message or error
    """
    try:
        if create_dirs:
            os.makedirs(os.path.dirname(destination_path), exist_ok=True)
        
        shutil.copy2(source_path, destination_path)
        return f"Successfully copied '{source_path}' to '{destination_path}'"
    except FileNotFoundError:
        return f"Error: Source file '{source_path}' not found"
    except PermissionError:
        return f"Error: Permission denied copying '{source_path}'"
    except Exception as e:
        return f"Error copying file '{source_path}': {str(e)}"


def move_file(source_path: str, destination_path: str, create_dirs: bool = True) -> str:
    """
    Move a file to a new location.
    
    Args:
        source_path (str): Path to the source file
        destination_path (str): Path to the destination
        create_dirs (bool): Whether to create parent directories if they don't exist
        
    Returns:
        str: Success message or error
    """
    try:
        if create_dirs:
            os.makedirs(os.path.dirname(destination_path), exist_ok=True)
        
        shutil.move(source_path, destination_path)
        return f"Successfully moved '{source_path}' to '{destination_path}'"
    except FileNotFoundError:
        return f"Error: Source file '{source_path}' not found"
    except PermissionError:
        return f"Error: Permission denied moving '{source_path}'"
    except Exception as e:
        return f"Error moving file '{source_path}': {str(e)}"


def get_file_info(file_path: str) -> str:
    """
    Get detailed information about a file or directory.
    
    Args:
        file_path (str): Path to the file or directory
        
    Returns:
        str: Detailed information about the file
    """
    try:
        if not os.path.exists(file_path):
            return f"Error: Path '{file_path}' not found"
        
        stat = os.stat(file_path)
        is_dir = os.path.isdir(file_path)
        
        info = f"Information for '{file_path}':\n\n"
        info += f"Type: {'Directory' if is_dir else 'File'}\n"
        info += f"Size: {stat.st_size} bytes\n"
        info += f"Created: {stat.st_ctime}\n"
        info += f"Modified: {stat.st_mtime}\n"
        info += f"Accessed: {stat.st_atime}\n"
        info += f"Permissions: {oct(stat.st_mode)[-3:]}\n"
        
        if is_dir:
            try:
                contents = os.listdir(file_path)
                info += f"Contents: {len(contents)} items\n"
            except PermissionError:
                info += "Contents: Permission denied\n"
        
        return info
        
    except PermissionError:
        return f"Error: Permission denied accessing '{file_path}'"
    except Exception as e:
        return f"Error getting info for '{file_path}': {str(e)}"


def search_files(directory_path: str, pattern: str, recursive: bool = True) -> str:
    """
    Search for files matching a pattern.
    
    Args:
        directory_path (str): Directory to search in
        pattern (str): Pattern to match (supports wildcards like *.py, *.txt)
        recursive (bool): Whether to search recursively
        
    Returns:
        str: List of matching files
    """
    try:
        if not os.path.exists(directory_path):
            return f"Error: Directory '{directory_path}' not found"
        
        if not os.path.isdir(directory_path):
            return f"Error: '{directory_path}' is not a directory"
        
        matches = []
        
        if recursive:
            for root, dirs, files in os.walk(directory_path):
                for file in files:
                    if file.lower().endswith(pattern.lower().replace('*', '')) or pattern in file:
                        matches.append(os.path.join(root, file))
        else:
            for file in os.listdir(directory_path):
                if file.lower().endswith(pattern.lower().replace('*', '')) or pattern in file:
                    matches.append(os.path.join(directory_path, file))
        
        if matches:
            result = f"Found {len(matches)} files matching '{pattern}' in '{directory_path}':\n\n"
            for match in sorted(matches):
                result += f"  📄 {match}\n"
        else:
            result = f"No files found matching '{pattern}' in '{directory_path}'"
        
        return result
        
    except PermissionError:
        return f"Error: Permission denied searching '{directory_path}'"
    except Exception as e:
        return f"Error searching files: {str(e)}"


def edit_file_content(file_path: str, old_content: str, new_content: str) -> str:
    """
    Edit specific content within a file by replacing old content with new content.
    
    Args:
        file_path (str): Path to the file to edit
        old_content (str): Content to replace
        new_content (str): New content to replace with
        
    Returns:
        str: Success message or error
    """
    try:
        if not os.path.exists(file_path):
            return f"Error: File '{file_path}' not found"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if old_content not in content:
            return f"Error: Old content not found in file '{file_path}'"
        
        new_file_content = content.replace(old_content, new_content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_file_content)
        
        return f"Successfully edited file '{file_path}' - replaced content"
        
    except PermissionError:
        return f"Error: Permission denied editing '{file_path}'"
    except Exception as e:
        return f"Error editing file '{file_path}': {str(e)}"


def append_to_file(file_path: str, content: str, create_if_not_exists: bool = True) -> str:
    """
    Append content to the end of a file.
    
    Args:
        file_path (str): Path to the file to append to
        content (str): Content to append
        create_if_not_exists (bool): Whether to create the file if it doesn't exist
        
    Returns:
        str: Success message or error
    """
    try:
        if not os.path.exists(file_path) and not create_if_not_exists:
            return f"Error: File '{file_path}' not found"
        
        if create_if_not_exists:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, 'a', encoding='utf-8') as f:
            f.write(content)
        
        return f"Successfully appended {len(content)} characters to '{file_path}'"
        
    except PermissionError:
        return f"Error: Permission denied appending to '{file_path}'"
    except Exception as e:
        return f"Error appending to file '{file_path}': {str(e)}"


def get_current_directory() -> str:
    """
    Get the current working directory.
    
    Returns:
        str: Current working directory path
    """
    try:
        return f"Current working directory: {os.getcwd()}"
    except Exception as e:
        return f"Error getting current directory: {str(e)}"


def change_directory(directory_path: str) -> str:
    """
    Change the current working directory.
    
    Args:
        directory_path (str): Path to the directory to change to
        
    Returns:
        str: Success message or error
    """
    try:
        if not os.path.exists(directory_path):
            return f"Error: Directory '{directory_path}' not found"
        
        if not os.path.isdir(directory_path):
            return f"Error: '{directory_path}' is not a directory"
        
        os.chdir(directory_path)
        return f"Successfully changed directory to: {os.getcwd()}"
        
    except PermissionError:
        return f"Error: Permission denied accessing '{directory_path}'"
    except Exception as e:
        return f"Error changing directory to '{directory_path}': {str(e)}"
