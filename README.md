# Nody VDE
Nody is an AI-native Visual Development Environment (VDE) that replaces traditional file-based coding with node-based visual architecture. It lets developers visualize their entire codebase as interconnected nodes and edges, powered by AI-assisted code generation and project understanding. Built with Next.js, ReactFlow, FastAPI, and ChromaDB, Nody reimagines how modern developers build, iterate, and collaborate on software.


## Features Implemented

✅ **Basic File Nodes**: Visual representation of files on canvas  
✅ **Code Editor**: Click file nodes to expand and edit code    
✅ **Node Management**: Create, read, update, delete files  

## Quick Start

### 1. Start the FastAPI Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The backend will run on `http://localhost:8000`

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:3000`

## How to Use

1. **View Files**: File nodes appear on the canvas representing your project files
2. **Edit Code**: Click the expand button (chevron) on any file node to open the code editor
3. **Save Changes**: Use the Save button in the code editor to persist changes
4. **Close Editor**: Click the X button to close the code editor

## API Endpoints

- `GET /files` - Get all file nodes
- `GET /files/{id}` - Get specific file node
- `PUT /files/{id}/content` - Update file content
- `POST /files` - Create new file
- `DELETE /files/{id}` - Delete file
- `PUT /files/{id}/position` - Update file position

## File Types Supported

- Python (.py)
- JavaScript (.js)
- TypeScript (.ts)
- JSON (.json)
- HTML (.html)
- CSS (.css)
- Plain text

## Demo
https://youtu.be/AwTgNbW1djk?feature=shared

## YC video
https://www.loom.com/share/8eae554ab88b4954b1cbcbec2030f767
