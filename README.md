# Nody VDE - Basic File Nodes

This is the basic file node implementation for Nody, a Visual Development Environment. Each node represents a file that can be clicked to expand into a code editor.

## Features Implemented

✅ **Basic File Nodes**: Visual representation of files on canvas  
✅ **Code Editor**: Click file nodes to expand and edit code  
✅ **FastAPI Backend**: RESTful API for file operations  
✅ **Real-time Editing**: Save changes directly to backend  
✅ **File Management**: Create, read, update, delete files  

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

## Next Steps

This basic implementation provides the foundation for:
- Strict nodes with code generation
- AI-powered VibeCoding
- Visual workflow execution
- Real-time collaboration
- Version control with visual diffing

## Architecture

- **Frontend**: Next.js + React + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python
- **Storage**: In-memory (demo) - ready for database integration
- **Communication**: RESTful API with CORS support
