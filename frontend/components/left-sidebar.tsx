"use client"

import type React from "react"

import { useState, useEffect } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Brain,
  Database,
  FileText,
  Globe2,
  Hammer,
  LayoutDashboard,
  ServerCog,
  Settings,
  ShieldCheck,
  Wrench,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { FileNode, NodeMetadata } from "@/lib/api"
import { Inspector } from "@/components/left-sidebar-inspector"

type NodeCategory = {
  id: string
  name: string
  icon: LucideIcon
  color: string
  dotColor: string
  bgColor: string
  borderColor: string
}

type BoilerplateTemplate = {
  defaultFileName: string
  fileType: string
  description: string
  content: string
}

type SidebarNodeTemplate = {
  label: string
  type: string
  isSpecial?: boolean
  description?: string
  badge?: string
  template?: BoilerplateTemplate
  categoryLabel: string
}

const nodeCategories: NodeCategory[] = [
  { id: "files", name: "Files", icon: FileText, color: "text-orange-400", dotColor: "bg-orange-400", bgColor: "bg-orange-400/10", borderColor: "border-orange-400/30" },
  { id: "ai-ml", name: "AI / ML Boilerplates", icon: Brain, color: "text-purple-400", dotColor: "bg-purple-400", bgColor: "bg-purple-400/10", borderColor: "border-purple-400/30" },
  { id: "web-api", name: "Web & API", icon: Globe2, color: "text-blue-400", dotColor: "bg-blue-400", bgColor: "bg-blue-400/10", borderColor: "border-blue-400/30" },
  { id: "backend-logic", name: "Backend Logic", icon: ServerCog, color: "text-indigo-400", dotColor: "bg-indigo-400", bgColor: "bg-indigo-400/10", borderColor: "border-indigo-400/30" },
  { id: "data-flow", name: "Database & Data Flow", icon: Database, color: "text-green-400", dotColor: "bg-green-400", bgColor: "bg-green-400/10", borderColor: "border-green-400/30" },
  { id: "devops", name: "DevOps & Infra", icon: Hammer, color: "text-teal-400", dotColor: "bg-teal-400", bgColor: "bg-teal-400/10", borderColor: "border-teal-400/30" },
  { id: "frontend-ui", name: "Frontend / UI", icon: LayoutDashboard, color: "text-pink-400", dotColor: "bg-pink-400", bgColor: "bg-pink-400/10", borderColor: "border-pink-400/30" },
  { id: "security", name: "Security & Auth", icon: ShieldCheck, color: "text-red-400", dotColor: "bg-red-400", bgColor: "bg-red-400/10", borderColor: "border-red-400/30" },
  { id: "utilities", name: "Utility / Common", icon: Wrench, color: "text-cyan-400", dotColor: "bg-cyan-400", bgColor: "bg-cyan-400/10", borderColor: "border-cyan-400/30" },
]

const nodeTemplates: Record<string, SidebarNodeTemplate[]> = {
  files: [
    { label: "New File", type: "file", isSpecial: true, description: "Create a blank file node", categoryLabel: "Files" },
    { label: "New Folder", type: "folder", isSpecial: true, description: "Organise files inside a visual folder", categoryLabel: "Files" },
  ],
  "ai-ml": [
    {
      label: "ChatGPT Prompt Call",
      type: "file",
      badge: "Python",
      description: "Call OpenAI chat completions with retry logic.",
      categoryLabel: "AI / ML Boilerplates",
      template: {
        defaultFileName: "openai_chat_completion.py",
        fileType: "python",
        description: "Wrapper for sending prompts to ChatGPT-compatible endpoints.",
        content: `"""OpenAI Chat Completion Wrapper

A standalone utility for calling OpenAI chat completions with retry logic.
Run this script directly to test the functionality.
"""

import httpx
import asyncio
import os
from typing import Optional


async def call_chatgpt(
    prompt: str, 
    *, 
    api_key: Optional[str] = None, 
    model: str = "gpt-4o-mini",
    max_retries: int = 3
) -> str:
    """
    Call OpenAI chat completions with retry logic.
    
    Args:
        prompt: The user prompt to send
        api_key: OpenAI API key (if None, will try to get from environment)
        model: Model to use (default: gpt-4o-mini)
        max_retries: Maximum number of retry attempts
        
    Returns:
        The response content from the model
    """
    # TODO: Add your API key here or set OPENAI_API_KEY environment variable
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OpenAI API key is required")
    
    async with httpx.AsyncClient(timeout=60) as client:
        for attempt in range(max_retries):
            try:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": "Bearer " + api_key},
                    json={
                        "model": model, 
                        "messages": [{"role": "user", "content": prompt}],
                        # TODO: Add additional parameters like temperature, max_tokens, etc.
                    },
                )
                response.raise_for_status()
                payload = response.json()
                return payload["choices"][0]["message"]["content"].strip()
                
            except httpx.HTTPStatusError as e:
                if attempt == max_retries - 1:
                    raise
                print("Attempt " + str(attempt + 1) + " failed: " + str(e))
                await asyncio.sleep(2 ** attempt)  # Exponential backoff


async def main():
    """Example usage of the ChatGPT wrapper."""
    try:
        # TODO: Replace with your actual prompt
        prompt = "Hello! Can you explain what Python async/await is?"
        
        print("Sending prompt: " + prompt)
        response = await call_chatgpt(prompt)
        print("Response: " + response)
        
    except Exception as e:
        print("Error: " + str(e))
        print("Make sure to set your OPENAI_API_KEY environment variable")


if __name__ == "__main__":
    # Run the example
    asyncio.run(main())
`,
      },
    },
    {
      label: "Text Embedding Generator",
      type: "file",
      badge: "Python",
      description: "Produce embeddings for text inputs.",
      categoryLabel: "AI / ML Boilerplates",
      template: {
        defaultFileName: "llm_embedding_generator.py",
        fileType: "python",
        description: "Generate vector embeddings from a list of strings.",
        content: `"""Text Embedding Generator

A standalone utility for generating vector embeddings from text inputs.
Run this script directly to test the functionality.
"""

import httpx
import asyncio
import os
from typing import Optional, List


async def embed_texts(
    texts: List[str], 
    *, 
    api_key: Optional[str] = None, 
    model: str = "text-embedding-3-small",
    max_retries: int = 3
) -> List[List[float]]:
    """
    Generate vector embeddings from a list of strings.
    
    Args:
        texts: List of text strings to embed
        api_key: OpenAI API key (if None, will try to get from environment)
        model: Embedding model to use
        max_retries: Maximum number of retry attempts
        
    Returns:
        List of embedding vectors (each vector is a list of floats)
    """
    # TODO: Add your API key here or set OPENAI_API_KEY environment variable
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OpenAI API key is required")
    
    async with httpx.AsyncClient(timeout=60) as client:
        for attempt in range(max_retries):
            try:
                response = await client.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": "Bearer " + api_key},
                    json={
                        "model": model, 
                        "input": texts,
                        # TODO: Add additional parameters like encoding_format, dimensions, etc.
                    },
                )
                response.raise_for_status()
                payload = response.json()
                return [item["embedding"] for item in payload.get("data", [])]
                
            except httpx.HTTPStatusError as e:
                if attempt == max_retries - 1:
                    raise
                print("Attempt " + str(attempt + 1) + " failed: " + str(e))
                await asyncio.sleep(2 ** attempt)  # Exponential backoff


async def main():
    """Example usage of the text embedding generator."""
    try:
        # TODO: Replace with your actual texts to embed
        texts = [
            "The quick brown fox jumps over the lazy dog",
            "Machine learning is fascinating",
            "Python is a great programming language"
        ]
        
        print("Generating embeddings for " + str(len(texts)) + " texts...")
        embeddings = await embed_texts(texts)
        
        for i, (text, embedding) in enumerate(zip(texts, embeddings)):
            print("Text " + str(i+1) + ": " + text)
            print("Embedding dimension: " + str(len(embedding)))
            print("First 5 values: " + str(embedding[:5]))
            print("-" * 50)
        
    except Exception as e:
        print("Error: " + str(e))
        print("Make sure to set your OPENAI_API_KEY environment variable")


if __name__ == "__main__":
    # Run the example
    asyncio.run(main())
`,
      },
    },
    {
      label: "Retrieval-Augmented Generation Pipeline",
      type: "file",
      badge: "Python",
      description: "Fetch context then answer questions.",
      categoryLabel: "AI / ML Boilerplates",
      template: {
        defaultFileName: "rag_pipeline.py",
        fileType: "python",
        description: "Minimal retrieval-augmented generation pipeline abstraction.",
        content: `"""Retrieval-Augmented Generation (RAG) Pipeline

A standalone utility for implementing RAG with customizable retriever and generator.
Run this script directly to test the functionality.
"""

import asyncio
import httpx
import os
from dataclasses import dataclass
from typing import Protocol, Sequence, Optional, List
from abc import ABC, abstractmethod


class Retriever(Protocol):
    """Protocol for document retrieval."""
    async def search(self, query: str, *, k: int = 5) -> Sequence[str]: ...


class Generator(Protocol):
    """Protocol for text generation."""
    async def complete(self, prompt: str) -> str: ...


@dataclass
class RAGPipeline:
    """RAG pipeline that combines retrieval and generation."""
    retriever: Retriever
    generator: Generator

    async def answer(self, question: str, k: int = 5) -> str:
        """
        Answer a question using RAG pipeline.
        
        Args:
            question: The question to answer
            k: Number of relevant chunks to retrieve
            
        Returns:
            Generated answer based on retrieved context
        """
        # Retrieve relevant context
        chunks = await self.retriever.search(question, k=k)
        
        # Build prompt with context
        context = "\\n".join(chunks)
        prompt = "Context:\n" + context + "\n\nQuestion: " + question + "\n\nAnswer based on the context above:"
        
        # Generate answer
        return await self.generator.complete(prompt)


class SimpleRetriever:
    """Simple in-memory document retriever."""
    
    def __init__(self, documents: List[str]):
        self.documents = documents
    
    async def search(self, query: str, *, k: int = 5) -> List[str]:
        """
        Simple keyword-based search.
        TODO: Replace with proper vector search (e.g., using embeddings)
        """
        query_lower = query.lower()
        scored_docs = []
        
        for doc in self.documents:
            # Simple scoring based on keyword matches
            score = sum(1 for word in query_lower.split() if word in doc.lower())
            if score > 0:
                scored_docs.append((score, doc))
        
        # Sort by score and return top k
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored_docs[:k]]


class OpenAIGenerator:
    """OpenAI-based text generator."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
    
    async def complete(self, prompt: str) -> str:
        """Generate completion using OpenAI API."""
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": "Bearer " + self.api_key},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    # TODO: Add additional parameters like temperature, max_tokens, etc.
                },
            )
            response.raise_for_status()
            payload = response.json()
            return payload["choices"][0]["message"]["content"].strip()


async def main():
    """Example usage of the RAG pipeline."""
    try:
        # TODO: Replace with your actual documents
        documents = [
            "Python is a high-level programming language known for its simplicity and readability.",
            "Machine learning is a subset of artificial intelligence that focuses on algorithms.",
            "Web development involves creating websites and web applications using various technologies.",
            "Data science combines statistics, programming, and domain expertise to extract insights.",
        ]
        
        # Initialize components
        retriever = SimpleRetriever(documents)
        generator = OpenAIGenerator()
        
        # Create RAG pipeline
        rag = RAGPipeline(retriever=retriever, generator=generator)
        
        # TODO: Replace with your actual questions
        questions = [
            "What is Python?",
            "How does machine learning work?",
            "What is web development?",
        ]
        
        for question in questions:
            print("\\nQuestion: " + question)
            answer = await rag.answer(question)
            print("Answer: " + answer)
            print("-" * 80)
        
    except Exception as e:
        print("Error: " + str(e))
        print("Make sure to set your OPENAI_API_KEY environment variable")


if __name__ == "__main__":
    # Run the example
    asyncio.run(main())
`,
      },
    },
    {
      label: "Image Captioning Function",
      type: "file",
      badge: "Python",
      description: "Generate captions for images via API.",
      categoryLabel: "AI / ML Boilerplates",
      template: {
        defaultFileName: "image_captioner.py",
        fileType: "python",
        description: "Upload an image and return a generated caption.",
        content: `"""Caption images using a hosted model."""
from pathlib import Path

import httpx


async def caption_image(image_path: Path, *, endpoint: str, api_key: str) -> str:
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(endpoint, headers={"Authorization": "Bearer " + api_key}, files={"file": image_path.read_bytes()})
        response.raise_for_status()
        return response.json().get("caption", "")
`,
      },
    },
    {
      label: "Sentiment Classifier",
      type: "file",
      badge: "Python",
      description: "Classify polarity of text snippets.",
      categoryLabel: "AI / ML Boilerplates",
      template: {
        defaultFileName: "sentiment_analysis.py",
        fileType: "python",
        description: "Simple sentiment scoring helper.",
        content: `"""Classify sentiment for text."""
def classify_sentiment(text: str) -> dict[str, float | str]:
    # Replace with real model call
    score = 1.0 if "good" in text.lower() else 0.0
    label = "positive" if score > 0.5 else "negative"
    return {"label": label, "score": score}
`,
      },
    },
    {
      label: "Text Summarization",
      type: "file",
      badge: "Python",
      description: "Summarise long-form text.",
      categoryLabel: "AI / ML Boilerplates",
      template: {
        defaultFileName: "text_summarizer.py",
        fileType: "python",
        description: "Produce condensed summaries using a language model.",
        content: `"""Summarise text content."""
def summarise(text: str) -> str:
    sentences = text.split(".")
    return ". ".join(sentences[:2]).strip()
`,
      },
    },
    {
      label: "Speech Recognition",
      type: "file",
      badge: "Python",
      description: "Transcribe audio to text.",
      categoryLabel: "AI / ML Boilerplates",
      template: {
        defaultFileName: "speech_to_text.py",
        fileType: "python",
        description: "Upload audio and return a transcript string.",
        content: `"""Speech-to-text placeholder."""
from pathlib import Path


async def transcribe(audio: Path) -> str:
    # Integrate with Whisper or other providers
    return "transcript"
`,
      },
    },
    {
      label: "TTS Output",
      type: "file",
      badge: "Python",
      description: "Convert text to speech audio.",
      categoryLabel: "AI / ML Boilerplates",
      template: {
        defaultFileName: "text_to_speech.py",
        fileType: "python",
        description: "Generate speech audio from text input.",
        content: `"""Text-to-speech placeholder."""
from pathlib import Path


async def text_to_speech(text: str, output_path: Path) -> Path:
    output_path.write_bytes(b"audio data")
    return output_path
`,
      },
    },
  ],
  "web-api": [
    {
      label: "HTTP Request (GET/POST)",
      type: "file",
      badge: "Python",
      description: "Reusable HTTP fetch helpers.",
      categoryLabel: "Web & API",
      template: {
        defaultFileName: "fetch_data.py",
        fileType: "python",
        description: "Perform GET and POST requests with httpx.",
        content: `"""HTTP helper functions."""
import httpx


async def get_json(url: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


async def post_json(url: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()
`,
      },
    },
    {
      label: "REST API Endpoint",
      type: "file",
      badge: "FastAPI",
      description: "FastAPI router with CRUD endpoints.",
      categoryLabel: "Web & API",
      template: {
        defaultFileName: "fastapi_endpoint.py",
        fileType: "python",
        description: "Expose GET/POST routes using FastAPI.",
        content: `"""FastAPI REST API Endpoint

A standalone FastAPI application with CRUD endpoints.
Run this script directly to start the server.
"""

from fastapi import FastAPI, APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

# TODO: Define your data models
class Item(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    price: Optional[float] = None

class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: Optional[float] = None

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None

# TODO: Replace with actual database/storage
items_db = []
next_id = 1

# Create FastAPI app
app = FastAPI(
    title="Items API",
    description="A simple CRUD API for managing items",
    version="1.0.0"
)

# Create router
router = APIRouter(prefix="/items", tags=["items"])

@router.get("/", response_model=List[Item])
async def list_items():
    """Get all items."""
    return items_db

@router.get("/{item_id}", response_model=Item)
async def get_item(item_id: int):
    """Get a specific item by ID."""
    # TODO: Add proper error handling and database lookup
    for item in items_db:
        if item["id"] == item_id:
            return item
    raise HTTPException(status_code=404, detail="Item not found")

@router.post("/", response_model=Item, status_code=status.HTTP_201_CREATED)
async def create_item(item: ItemCreate):
    """Create a new item."""
    global next_id
    
    # TODO: Add validation logic here
    if not item.name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    
    # Create new item
    new_item = {
        "id": next_id,
        "name": item.name,
        "description": item.description,
        "price": item.price
    }
    
    items_db.append(new_item)
    next_id += 1
    
    return new_item

@router.put("/{item_id}", response_model=Item)
async def update_item(item_id: int, item_update: ItemUpdate):
    """Update an existing item."""
    # TODO: Add proper error handling and database update
    for i, item in enumerate(items_db):
        if item["id"] == item_id:
            # Update fields
            if item_update.name is not None:
                item["name"] = item_update.name
            if item_update.description is not None:
                item["description"] = item_update.description
            if item_update.price is not None:
                item["price"] = item_update.price
            
            items_db[i] = item
            return item
    
    raise HTTPException(status_code=404, detail="Item not found")

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: int):
    """Delete an item."""
    # TODO: Add proper error handling and database deletion
    for i, item in enumerate(items_db):
        if item["id"] == item_id:
            items_db.pop(i)
            return
    
    raise HTTPException(status_code=404, detail="Item not found")

# Include router in app
app.include_router(router)

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Items API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "items": "/items",
            "health": "/health"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "items_count": len(items_db)}

def main():
    """Run the FastAPI server."""
    print("Starting Items API server...")
    print("API Documentation available at: http://localhost:8000/docs")
    print("Press Ctrl+C to stop the server")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=True  # TODO: Set to False in production
    )

if __name__ == "__main__":
    main()
`,
      },
    },
    {
      label: "GraphQL Query Resolver",
      type: "file",
      badge: "Python",
      description: "Resolver skeleton for GraphQL queries.",
      categoryLabel: "Web & API",
      template: {
        defaultFileName: "graphql_resolver.py",
        fileType: "python",
        description: "Stub GraphQL schema and resolver.",
        content: `"""GraphQL query resolver."""
import strawberry


@strawberry.type
class Query:
    @strawberry.field
    async def hello(self) -> str:
        return "world"


schema = strawberry.Schema(query=Query)
`,
      },
    },
    {
      label: "WebSocket Server",
      type: "file",
      badge: "Node",
      description: "Broadcast messages over WebSocket.",
      categoryLabel: "Web & API",
      template: {
        defaultFileName: "socket_server.js",
        fileType: "javascript",
        description: "Simple ws server for broadcasting events.",
        content: `"""WebSocket Server

A standalone WebSocket server for real-time communication.
Run this script directly to start the server.
"""

import { WebSocketServer } from "ws"
import http from "http"

// TODO: Configure your server settings
const PORT = process.env.PORT || 8080
const HOST = process.env.HOST || "localhost"

// Create HTTP server
const server = http.createServer()

// Create WebSocket server
const wss = new WebSocketServer({ 
  server,
  // TODO: Add additional WebSocket options like path, verifyClient, etc.
})

// Store connected clients
const clients = new Set()

wss.on("connection", (socket, request) => {
  console.log("New client connected from " + request.socket.remoteAddress)
  clients.add(socket)
  
  // TODO: Add authentication logic here
  // Example: socket.send(JSON.stringify({ type: "auth_required" }))
  
  socket.on("message", (data) => {
    try {
      const message = data.toString()
      console.log("Received message: " + message)
      
      // TODO: Add message processing logic here
      // Example: const parsed = JSON.parse(message)
      
      // Broadcast to all connected clients
      broadcast(message, socket)
      
    } catch (error) {
      console.error("Error processing message:", error)
      socket.send(JSON.stringify({ 
        type: "error", 
        message: "Invalid message format" 
      }))
    }
  })
  
  socket.on("close", () => {
    console.log("Client disconnected")
    clients.delete(socket)
  })
  
  socket.on("error", (error) => {
    console.error("WebSocket error:", error)
    clients.delete(socket)
  })
  
  // Send welcome message
  socket.send(JSON.stringify({ 
    type: "welcome", 
    message: "Connected to WebSocket server",
    timestamp: new Date().toISOString()
  }))
})

function broadcast(message, sender) {
  const messageData = {
    type: "broadcast",
    message: message,
    timestamp: new Date().toISOString(),
    sender: sender === sender ? "you" : "other"
  }
  
  clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(messageData))
    }
  })
}

// TODO: Add additional server functionality
// Example: REST API endpoints, database connections, etc.

server.listen(PORT, HOST, () => {
  console.log("WebSocket server listening on ws://" + HOST + ":" + PORT)
  console.log("Press Ctrl+C to stop the server")
})

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\\nShutting down server...")
  wss.close(() => {
    server.close(() => {
      console.log("Server closed")
      process.exit(0)
    })
  })
})
`,
      },
    },
    {
      label: "Webhook Receiver",
      type: "file",
      badge: "Python",
      description: "Validate and accept webhook payloads.",
      categoryLabel: "Web & API",
      template: {
        defaultFileName: "webhook_handler.py",
        fileType: "python",
        description: "Receive webhook events and verify signatures.",
        content: `"""Webhook receiver."""
from fastapi import APIRouter, HTTPException


router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/events")
async def receive_event(payload: dict) -> dict:
    if "event" not in payload:
        raise HTTPException(status_code=400, detail="Invalid payload")
    return {"received": True}
`,
      },
    },
    {
      label: "JWT Auth Middleware",
      type: "file",
      badge: "TypeScript",
      description: "Next.js middleware verifying JWT tokens.",
      categoryLabel: "Web & API",
      template: {
        defaultFileName: "auth_middleware.ts",
        fileType: "typescript",
        description: "Auth middleware for Next.js routes.",
        content: `import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const SECRET = process.env.AUTH_SECRET ?? "replace-me"

export function middleware(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "")
  if (!token || token !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.next()
}
`,
      },
    },
    {
      label: "CORS Policy Config",
      type: "file",
      badge: "JavaScript",
      description: "Express middleware for CORS setup.",
      categoryLabel: "Web & API",
      template: {
        defaultFileName: "cors_handler.js",
        fileType: "javascript",
        description: "Configure CORS for an Express app.",
        content: `import cors from "cors"

export function createCorsMiddleware() {
  return cors({ origin: ["http://localhost:3000"], credentials: true })
}
`,
      },
    },
  ],
  "backend-logic": [
    {
      label: "User CRUD Service",
      type: "file",
      badge: "Python",
      description: "Service encapsulating basic CRUD operations.",
      categoryLabel: "Backend Logic",
      template: {
        defaultFileName: "user_service.py",
        fileType: "python",
        description: "User service layer with repository dependency.",
        content: `"""User Service Layer

A standalone user service with repository pattern.
Run this script directly to test the functionality.
"""

import asyncio
from dataclasses import dataclass
from typing import Protocol, Optional, Dict, Any
from abc import ABC, abstractmethod
import json
import os


class UserRepository(Protocol):
    """Protocol for user data access."""
    async def create(self, payload: dict) -> dict: ...
    async def get(self, user_id: str) -> dict | None: ...
    async def update(self, user_id: str, payload: dict) -> dict: ...
    async def delete(self, user_id: str) -> None: ...
    async def get_by_email(self, email: str) -> dict | None: ...


@dataclass
class UserService:
    """User service layer with business logic."""
    repository: UserRepository

    async def create_user(self, payload: dict) -> dict:
        """
        Create a new user with validation.
        
        Args:
            payload: User data including email, name, etc.
            
        Returns:
            Created user data
        """
        # TODO: Add validation logic here
        if "email" not in payload:
            raise ValueError("Email is required")
        
        if "name" not in payload:
            raise ValueError("Name is required")
        
        # TODO: Add email format validation
        # TODO: Add password hashing if needed
        # TODO: Add duplicate email check
        
        return await self.repository.create(payload)

    async def get_user(self, user_id: str) -> dict | None:
        """Get user by ID."""
        # TODO: Add authorization checks here
        return await self.repository.get(user_id)

    async def update_user(self, user_id: str, payload: dict) -> dict:
        """Update user data."""
        # TODO: Add validation logic here
        # TODO: Add authorization checks here
        
        existing_user = await self.repository.get(user_id)
        if not existing_user:
            raise ValueError("User not found")
        
        return await self.repository.update(user_id, payload)

    async def delete_user(self, user_id: str) -> None:
        """Delete user."""
        # TODO: Add authorization checks here
        # TODO: Add cascade delete logic for related data
        
        existing_user = await self.repository.get(user_id)
        if not existing_user:
            raise ValueError("User not found")
        
        await self.repository.delete(user_id)

    async def get_user_by_email(self, email: str) -> dict | None:
        """Get user by email address."""
        # TODO: Add email validation here
        return await self.repository.get_by_email(email)


class InMemoryUserRepository:
    """In-memory implementation of UserRepository for testing."""
    
    def __init__(self):
        self.users = {}
        self.next_id = 1
    
    async def create(self, payload: dict) -> dict:
        """Create a new user."""
        user_id = str(self.next_id)
        user = {
            "id": user_id,
            "email": payload["email"],
            "name": payload["name"],
            "created_at": "2024-01-01T00:00:00Z"  # TODO: Use actual timestamp
        }
        self.users[user_id] = user
        self.next_id += 1
        return user
    
    async def get(self, user_id: str) -> dict | None:
        """Get user by ID."""
        return self.users.get(user_id)
    
    async def update(self, user_id: str, payload: dict) -> dict:
        """Update user data."""
        if user_id not in self.users:
            raise ValueError("User not found")
        
        # Update fields
        for key, value in payload.items():
            if key != "id":  # Don't allow ID changes
                self.users[user_id][key] = value
        
        return self.users[user_id]
    
    async def delete(self, user_id: str) -> None:
        """Delete user."""
        if user_id not in self.users:
            raise ValueError("User not found")
        del self.users[user_id]
    
    async def get_by_email(self, email: str) -> dict | None:
        """Get user by email."""
        for user in self.users.values():
            if user["email"] == email:
                return user
        return None


async def main():
    """Example usage of the user service."""
    try:
        # Initialize repository and service
        repository = InMemoryUserRepository()
        user_service = UserService(repository=repository)
        
        # TODO: Replace with your actual user data
        test_users = [
            {"email": "john@example.com", "name": "John Doe"},
            {"email": "jane@example.com", "name": "Jane Smith"},
        ]
        
        print("Creating users...")
        created_users = []
        for user_data in test_users:
            user = await user_service.create_user(user_data)
            created_users.append(user)
            print("Created user: " + user['name'] + " (" + user['email'] + ")")
        
        print("\\nRetrieving users...")
        for user in created_users:
            retrieved = await user_service.get_user(user["id"])
            print("Retrieved: " + retrieved['name'])
        
        print("\\nUpdating user...")
        if created_users:
            updated = await user_service.update_user(
                created_users[0]["id"], 
                {"name": "John Updated"}
            )
            print("Updated user: " + updated['name'])
        
        print("\\nSearching by email...")
        found_user = await user_service.get_user_by_email("jane@example.com")
        if found_user:
            print("Found user by email: " + found_user['name'])
        
    except Exception as e:
        print("Error: " + str(e))


if __name__ == "__main__":
    # Run the example
    asyncio.run(main())
`,
      },
    },
    {
      label: "Order Processing Logic",
      type: "file",
      badge: "Python",
      description: "Workflow orchestrator for orders.",
      categoryLabel: "Backend Logic",
      template: {
        defaultFileName: "order_processor.py",
        fileType: "python",
        description: "Process orders and call payment gateway.",
        content: `"""Order Processing Logic

A standalone order processing workflow with payment integration.
Run this script directly to test the functionality.
"""

import asyncio
from dataclasses import dataclass
from typing import Protocol, Optional, Dict, Any
from enum import Enum
import json
import os


class OrderStatus(Enum):
    """Order status enumeration."""
    PENDING = "pending"
    PROCESSING = "processing"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PaymentGateway(Protocol):
    """Protocol for payment processing."""
    async def charge(self, payload: dict) -> dict: ...
    async def refund(self, transaction_id: str, amount: float) -> dict: ...


class OrderRepository(Protocol):
    """Protocol for order data access."""
    async def create(self, order_data: dict) -> dict: ...
    async def get(self, order_id: str) -> dict | None: ...
    async def update_status(self, order_id: str, status: OrderStatus) -> dict: ...
    async def mark_paid(self, order_id: str, transaction_id: str) -> dict: ...


@dataclass
class OrderProcessor:
    """Order processing workflow orchestrator."""
    payments: PaymentGateway
    orders: OrderRepository

    async def process_order(self, order_data: dict) -> dict:
        """
        Process a complete order workflow.
        
        Args:
            order_data: Order information including items, customer, etc.
            
        Returns:
            Processed order with status and transaction details
        """
        try:
            # TODO: Add order validation logic here
            if not order_data.get("items"):
                raise ValueError("Order must contain items")
            
            if not order_data.get("customer_id"):
                raise ValueError("Customer ID is required")
            
            # Create order
            order = await self.orders.create(order_data)
            print("Created order: " + order['id'])
            
            # Update status to processing
            await self.orders.update_status(order["id"], OrderStatus.PROCESSING)
            
            # Calculate total amount
            total_amount = self._calculate_total(order_data["items"])
            print("Order total: $" + str(total_amount))
            
            # Process payment
            payment_data = {
                "amount": total_amount,
                "currency": order_data.get("currency", "USD"),
                "customer_id": order_data["customer_id"],
                "order_id": order["id"],
                # TODO: Add payment method details
            }
            
            payment_result = await self.payments.charge(payment_data)
            print("Payment processed: " + payment_result['transaction_id'])
            
            # Mark order as paid
            paid_order = await self.orders.mark_paid(
                order["id"], 
                payment_result["transaction_id"]
            )
            
            print("Order " + order['id'] + " processed successfully")
            return paid_order
            
        except Exception as e:
            print("Order processing failed: " + str(e))
            # TODO: Add proper error handling and rollback logic
            if "order" in locals():
                await self.orders.update_status(order["id"], OrderStatus.FAILED)
            raise

    def _calculate_total(self, items: list) -> float:
        """Calculate order total from items."""
        # TODO: Add tax calculation logic here
        # TODO: Add discount logic here
        # TODO: Add shipping cost calculation here
        
        total = 0
        for item in items:
            price = item.get("price", 0)
            quantity = item.get("quantity", 1)
            total += price * quantity
        
        return total


class MockPaymentGateway:
    """Mock payment gateway for testing."""
    
    async def charge(self, payload: dict) -> dict:
        """Process a payment."""
        # TODO: Replace with actual payment gateway integration
        # Example: Stripe, PayPal, etc.
        
        amount = payload["amount"]
        if amount <= 0:
            raise ValueError("Invalid payment amount")
        
        # Simulate payment processing
        await asyncio.sleep(0.1)  # Simulate network delay
        
        return {
            "transaction_id": "txn_" + str(len(str(amount))) + "_" + str(amount),
            "status": "succeeded",
            "amount": amount,
            "currency": payload["currency"]
        }
    
    async def refund(self, transaction_id: str, amount: float) -> dict:
        """Process a refund."""
        # TODO: Implement refund logic
        return {
            "refund_id": "refund_" + transaction_id,
            "status": "succeeded",
            "amount": amount
        }


class InMemoryOrderRepository:
    """In-memory order repository for testing."""
    
    def __init__(self):
        self.orders = {}
        self.next_id = 1
    
    async def create(self, order_data: dict) -> dict:
        """Create a new order."""
        order_id = str(self.next_id)
        order = {
            "id": order_id,
            "customer_id": order_data["customer_id"],
            "items": order_data["items"],
            "status": OrderStatus.PENDING.value,
            "created_at": "2024-01-01T00:00:00Z",  # TODO: Use actual timestamp
            "total_amount": self._calculate_total(order_data["items"])
        }
        self.orders[order_id] = order
        self.next_id += 1
        return order
    
    async def get(self, order_id: str) -> dict | None:
        """Get order by ID."""
        return self.orders.get(order_id)
    
    async def update_status(self, order_id: str, status: OrderStatus) -> dict:
        """Update order status."""
        if order_id not in self.orders:
            raise ValueError("Order not found")
        
        self.orders[order_id]["status"] = status.value
        return self.orders[order_id]
    
    async def mark_paid(self, order_id: str, transaction_id: str) -> dict:
        """Mark order as paid."""
        if order_id not in self.orders:
            raise ValueError("Order not found")
        
        self.orders[order_id]["status"] = OrderStatus.PAID.value
        self.orders[order_id]["transaction_id"] = transaction_id
        return self.orders[order_id]
    
    def _calculate_total(self, items: list) -> float:
        """Calculate order total."""
        total = 0
        for item in items:
            price = item.get("price", 0)
            quantity = item.get("quantity", 1)
            total += price * quantity
        return total


async def main():
    """Example usage of the order processor."""
    try:
        # Initialize components
        payment_gateway = MockPaymentGateway()
        order_repository = InMemoryOrderRepository()
        order_processor = OrderProcessor(
            payments=payment_gateway,
            orders=order_repository
        )
        
        # TODO: Replace with your actual order data
        test_orders = [
            {
                "customer_id": "customer_123",
                "items": [
                    {"name": "Product A", "price": 29.99, "quantity": 2},
                    {"name": "Product B", "price": 15.50, "quantity": 1}
                ],
                "currency": "USD"
            },
            {
                "customer_id": "customer_456",
                "items": [
                    {"name": "Product C", "price": 99.99, "quantity": 1}
                ],
                "currency": "USD"
            }
        ]
        
        print("Processing orders...")
        processed_orders = []
        
        for order_data in test_orders:
            try:
                processed_order = await order_processor.process_order(order_data)
                processed_orders.append(processed_order)
                print("✅ Order " + processed_order['id'] + " processed successfully")
            except Exception as e:
                print("❌ Order processing failed: " + str(e))
        
        print("\\nProcessed " + str(len(processed_orders)) + " orders successfully")
        
        # Display order summary
        for order in processed_orders:
            print("Order " + order['id'] + ": $" + str(order['total_amount']) + " - " + order['status'])
        
    except Exception as e:
        print("Error: " + str(e))


if __name__ == "__main__":
    # Run the example
    asyncio.run(main())
`,
      },
    },
    {
      label: "Send Email (SMTP/SES)",
      type: "file",
      badge: "Python",
      description: "Send transactional emails.",
      categoryLabel: "Backend Logic",
      template: {
        defaultFileName: "email_sender.py",
        fileType: "python",
        description: "Send simple text email via SMTP.",
        content: `"""Email Sender Service

A standalone email service for sending transactional emails.
Run this script directly to test the functionality.
"""

import smtplib
import asyncio
import os
from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, List, Dict, Any
import json


class EmailService:
    """Email service for sending transactional emails."""
    
    def __init__(self, smtp_host: str, smtp_port: int, smtp_user: str, smtp_password: str):
        """
        Initialize email service.
        
        Args:
            smtp_host: SMTP server hostname
            smtp_port: SMTP server port
            smtp_user: SMTP username
            smtp_password: SMTP password
        """
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
    
    async def send_email(
        self, 
        to_addresses: List[str], 
        subject: str, 
        body: str,
        from_address: Optional[str] = None,
        html_body: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        Send an email.
        
        Args:
            to_addresses: List of recipient email addresses
            subject: Email subject
            body: Plain text email body
            from_address: Sender email address (defaults to smtp_user)
            html_body: HTML email body (optional)
            attachments: List of attachment dictionaries
            
        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            # TODO: Add email validation here
            if not to_addresses:
                raise ValueError("At least one recipient is required")
            
            if not subject.strip():
                raise ValueError("Subject cannot be empty")
            
            if not body.strip():
                raise ValueError("Email body cannot be empty")
            
            # Create email message
            if html_body:
                # Create multipart message for HTML
                message = MIMEMultipart("alternative")
                message.attach(MIMEText(body, "plain"))
                message.attach(MIMEText(html_body, "html"))
            else:
                # Simple text message
                message = EmailMessage()
                message.set_content(body)
            
            # Set headers
            message["To"] = ", ".join(to_addresses)
            message["Subject"] = subject
            message["From"] = from_address or self.smtp_user
            
            # TODO: Add custom headers if needed
            # message["Reply-To"] = "noreply@example.com"
            
            # TODO: Add attachment handling here
            if attachments:
                for attachment in attachments:
                    # TODO: Implement attachment logic
                    pass
            
            # Send email
            await self._send_smtp_email(message)
            print(f"Email sent successfully to: {', '.join(to_addresses)}")
            return True
            
        except Exception as e:
            print(f"Failed to send email: {e}")
            return False
    
    async def _send_smtp_email(self, message: EmailMessage) -> None:
        """Send email via SMTP."""
        # TODO: Add connection pooling for better performance
        # TODO: Add retry logic for failed sends
        
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            # TODO: Add TLS/SSL configuration
            # server.starttls()
            
            # TODO: Add authentication
            # server.login(self.smtp_user, self.smtp_password)
            
            # For testing, we'll just print the email
            print("\\n" + "="*50)
            print("EMAIL CONTENT (SMTP not configured):")
            print(f"To: {message['To']}")
            print(f"From: {message['From']}")
            print(f"Subject: {message['Subject']}")
            print("Body:")
            print(message.get_content())
            print("="*50 + "\\n")
            
            # TODO: Uncomment when SMTP is configured
            # server.send_message(message)
    
    async def send_welcome_email(self, user_email: str, user_name: str) -> bool:
        """Send a welcome email to new users."""
        subject = "Welcome to our platform!"
        body = f"""Hi {user_name},

Welcome to our platform! We're excited to have you on board.

Here are some next steps:
- Complete your profile setup
- Explore our features
- Join our community

If you have any questions, feel free to reach out to our support team.

Best regards,
The Team"""

        html_body = f"""
        <html>
        <body>
            <h2>Welcome {user_name}!</h2>
            <p>Welcome to our platform! We're excited to have you on board.</p>
            <ul>
                <li>Complete your profile setup</li>
                <li>Explore our features</li>
                <li>Join our community</li>
            </ul>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br>The Team</p>
        </body>
        </html>
        """
        
        return await self.send_email(
            to_addresses=[user_email],
            subject=subject,
            body=body,
            html_body=html_body
        )
    
    async def send_password_reset_email(self, user_email: str, reset_token: str) -> bool:
        """Send password reset email."""
        # TODO: Replace with your actual reset URL
        reset_url = f"https://yourapp.com/reset-password?token={reset_token}"
        
        subject = "Password Reset Request"
        body = f"""Hi,

You requested a password reset for your account.

Click the link below to reset your password:
{reset_url}

This link will expire in 1 hour.

If you didn't request this reset, please ignore this email.

Best regards,
The Team"""

        return await self.send_email(
            to_addresses=[user_email],
            subject=subject,
            body=body
        )


async def main():
    """Example usage of the email service."""
    try:
        # TODO: Configure your SMTP settings
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "your-email@gmail.com")
        smtp_password = os.getenv("SMTP_PASSWORD", "your-app-password")
        
        # Initialize email service
        email_service = EmailService(
            smtp_host=smtp_host,
            smtp_port=smtp_port,
            smtp_user=smtp_user,
            smtp_password=smtp_password
        )
        
        # TODO: Replace with your actual email addresses
        test_emails = [
            "test1@example.com",
            "test2@example.com"
        ]
        
        print("Sending test emails...")
        
        # Send welcome email
        success = await email_service.send_welcome_email(
            user_email=test_emails[0],
            user_name="John Doe"
        )
        
        if success:
            print("✅ Welcome email sent successfully")
        else:
            print("❌ Welcome email failed")
        
        # Send password reset email
        success = await email_service.send_password_reset_email(
            user_email=test_emails[1],
            reset_token="sample-reset-token-123"
        )
        
        if success:
            print("✅ Password reset email sent successfully")
        else:
            print("❌ Password reset email failed")
        
        # Send custom email
        success = await email_service.send_email(
            to_addresses=test_emails,
            subject="Test Email from Email Service",
            body="This is a test email sent from the email service.",
            html_body="<h1>Test Email</h1><p>This is a <strong>test email</strong> sent from the email service.</p>"
        )
        
        if success:
            print("✅ Custom email sent successfully")
        else:
            print("❌ Custom email failed")
        
    except Exception as e:
        print("Error: " + str(e))
        print("Make sure to configure your SMTP settings in environment variables")


if __name__ == "__main__":
    # Run the example
    asyncio.run(main())
`,
      },
    },
    {
      label: "Stripe / PayPal Integration",
      type: "file",
      badge: "JavaScript",
      description: "Facade over payment providers.",
      categoryLabel: "Backend Logic",
      template: {
        defaultFileName: "payment_gateway.js",
        fileType: "javascript",
        description: "Wrap Stripe/PayPal SDK calls.",
        content: `export class PaymentGateway {
  constructor(stripeClient, paypalClient) {
    this.stripe = stripeClient
    this.paypal = paypalClient
  }

  async chargeWithStripe(payload) {
    return this.stripe.paymentIntents.create(payload)
  }

  async chargeWithPaypal(payload) {
    return this.paypal.payment.create(payload)
  }
}
`,
      },
    },
    {
      label: "Push Notifications",
      type: "file",
      badge: "TypeScript",
      description: "Dispatch push notifications.",
      categoryLabel: "Backend Logic",
      template: {
        defaultFileName: "notification_dispatcher.ts",
        fileType: "typescript",
        description: "Send web push notifications to subscribers.",
        content: `import webpush from "web-push"

export async function sendNotification(subscription: webpush.PushSubscription, payload: Record<string, unknown>) {
  await webpush.sendNotification(subscription, JSON.stringify(payload))
}
`,
      },
    },
    {
      label: "Celery / Cron Job Task",
      type: "file",
      badge: "Python",
      description: "Scheduled task worker skeleton.",
      categoryLabel: "Backend Logic",
      template: {
        defaultFileName: "scheduler_worker.py",
        fileType: "python",
        description: "Celery task that runs on a schedule.",
        content: `"""Celery scheduled worker."""
from celery import Celery


app = Celery("worker", broker="redis://localhost:6379/0")


@app.task
def heartbeat() -> str:
    return "ok"
`,
      },
    },
  ],
  "data-flow": [
    {
      label: "Database Connector",
      type: "file",
      badge: "Python",
      description: "Create SQLAlchemy engine/session.",
      categoryLabel: "Database & Data Flow",
      template: {
        defaultFileName: "db_connection.py",
        fileType: "python",
        description: "Create SQLAlchemy session factory.",
        content: `"""Database Connection Manager

A standalone database connection manager with SQLAlchemy.
Run this script directly to test the functionality.
"""

import asyncio
import os
from sqlalchemy import create_engine, text, MetaData, Table, Column, Integer, String, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from typing import Optional, Dict, Any, List
import json
from datetime import datetime


Base = declarative_base()


class User(Base):
    """Example user model."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DatabaseManager:
    """Database connection and session manager."""
    
    def __init__(self, database_url: str, async_mode: bool = False):
        """
        Initialize database manager.
        
        Args:
            database_url: Database connection URL
            async_mode: Whether to use async SQLAlchemy
        """
        self.database_url = database_url
        self.async_mode = async_mode
        
        if async_mode:
            # TODO: Add async engine configuration
            self.engine = create_async_engine(
                database_url,
                echo=True,  # TODO: Set to False in production
                # TODO: Add connection pool settings
                # pool_size=10,
                # max_overflow=20,
                # pool_pre_ping=True,
            )
            self.session_factory = async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
        else:
            # TODO: Add sync engine configuration
            self.engine = create_engine(
                database_url,
                echo=True,  # TODO: Set to False in production
                # TODO: Add connection pool settings
                # pool_size=10,
                # max_overflow=20,
                # pool_pre_ping=True,
            )
            self.session_factory = sessionmaker(
                bind=self.engine,
                expire_on_commit=False
            )
    
    async def create_tables(self):
        """Create all tables."""
        # TODO: Add proper table creation logic
        if self.async_mode:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        else:
            Base.metadata.create_all(self.engine)
        print("Tables created successfully")
    
    async def test_connection(self) -> bool:
        """Test database connection."""
        try:
            if self.async_mode:
                async with self.session_factory() as session:
                    result = await session.execute(text("SELECT 1"))
                    return result.scalar() == 1
            else:
                with self.session_factory() as session:
                    result = session.execute(text("SELECT 1"))
                    return result.scalar() == 1
        except Exception as e:
            print(f"Database connection test failed: {e}")
            return False
    
    async def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Execute a raw SQL query."""
        # TODO: Add query validation and sanitization
        try:
            if self.async_mode:
                async with self.session_factory() as session:
                    result = await session.execute(text(query), params or {})
                    return [dict(row._mapping) for row in result]
            else:
                with self.session_factory() as session:
                    result = session.execute(text(query), params or {})
                    return [dict(row._mapping) for row in result]
        except Exception as e:
            print(f"Query execution failed: {e}")
            return []
    
    async def create_user(self, name: str, email: str) -> Optional[User]:
        """Create a new user."""
        try:
            if self.async_mode:
                async with self.session_factory() as session:
                    user = User(name=name, email=email)
                    session.add(user)
                    await session.commit()
                    await session.refresh(user)
                    return user
            else:
                with self.session_factory() as session:
                    user = User(name=name, email=email)
                    session.add(user)
                    session.commit()
                    session.refresh(user)
                    return user
        except Exception as e:
            print(f"Failed to create user: {e}")
            return None
    
    async def get_users(self) -> List[User]:
        """Get all users."""
        try:
            if self.async_mode:
                async with self.session_factory() as session:
                    result = await session.execute(text("SELECT * FROM users"))
                    return [User(**dict(row._mapping)) for row in result]
            else:
                with self.session_factory() as session:
                    result = session.execute(text("SELECT * FROM users"))
                    return [User(**dict(row._mapping)) for row in result]
        except Exception as e:
            print(f"Failed to get users: {e}")
            return []


async def main():
    """Example usage of the database manager."""
    try:
        # TODO: Configure your database URL
        # Examples:
        # SQLite: "sqlite:///./test.db"
        # PostgreSQL: "postgresql://user:password@localhost/dbname"
        # MySQL: "mysql://user:password@localhost/dbname"
        # Async PostgreSQL: "postgresql+asyncpg://user:password@localhost/dbname"
        
        database_url = os.getenv("DATABASE_URL", "sqlite:///./test.db")
        async_mode = os.getenv("ASYNC_MODE", "false").lower() == "true"
        
        print(f"Connecting to database: {database_url}")
        print(f"Async mode: {async_mode}")
        
        # Initialize database manager
        db_manager = DatabaseManager(database_url, async_mode=async_mode)
        
        # Test connection
        if await db_manager.test_connection():
            print("✅ Database connection successful")
        else:
            print("❌ Database connection failed")
            return
        
        # Create tables
        await db_manager.create_tables()
        
        # Create test users
        print("\\nCreating test users...")
        test_users = [
            {"name": "John Doe", "email": "john@example.com"},
            {"name": "Jane Smith", "email": "jane@example.com"},
            {"name": "Bob Johnson", "email": "bob@example.com"},
        ]
        
        created_users = []
        for user_data in test_users:
            user = await db_manager.create_user(user_data["name"], user_data["email"])
            if user:
                created_users.append(user)
                print(f"Created user: {user.name} ({user.email})")
        
        # Query users
        print("\\nQuerying users...")
        users = await db_manager.get_users()
        print(f"Found {len(users)} users:")
        for user in users:
            print(f"- {user.name} ({user.email})")
        
        # Execute custom query
        print("\\nExecuting custom query...")
        result = await db_manager.execute_query("SELECT COUNT(*) as user_count FROM users")
        if result:
            print(f"Total users: {result[0]['user_count']}")
        
        print("\\n✅ Database operations completed successfully")
        
    except Exception as e:
        print("Error: " + str(e))
        print("Make sure to configure your DATABASE_URL environment variable")


if __name__ == "__main__":
    # Run the example
    asyncio.run(main())
`,
      },
    },
    {
      label: "MongoDB Query",
      type: "file",
      badge: "Python",
      description: "Compose Mongo queries.",
      categoryLabel: "Database & Data Flow",
      template: {
        defaultFileName: "mongo_query_builder.py",
        fileType: "python",
        description: "Build MongoDB filter/projection payloads.",
        content: `"""Mongo query helper."""
from typing import Any, Dict


def build_query(filters: Dict[str, Any], projection: Dict[str, int] | None = None) -> Dict[str, Any]:
    query = dict(filters)
    if projection:
        query["projection"] = projection
    return query
`,
      },
    },
    {
      label: "SQLAlchemy Model",
      type: "file",
      badge: "Python",
      description: "Declarative model skeleton.",
      categoryLabel: "Database & Data Flow",
      template: {
        defaultFileName: "sql_model.py",
        fileType: "python",
        description: "SQLAlchemy model with timestamps.",
        content: `"""SQLAlchemy item model."""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=datetime.utcnow)
`,
      },
    },
    {
      label: "Redis Cache Layer",
      type: "file",
      badge: "Python",
      description: "Wrapper around Redis operations.",
      categoryLabel: "Database & Data Flow",
      template: {
        defaultFileName: "cache_handler.py",
        fileType: "python",
        description: "Small async Redis cache utility.",
        content: `"""Redis cache helper."""
import aioredis


class Cache:
    def __init__(self, url: str) -> None:
        self._url = url

    async def set(self, key: str, value: str, *, ttl: int | None = None) -> None:
        redis = await aioredis.from_url(self._url)
        if ttl:
            await redis.setex(key, ttl, value)
        else:
            await redis.set(key, value)
`,
      },
    },
    {
      label: "Data Cleaning Utility",
      type: "file",
      badge: "Python",
      description: "Normalise incoming data records.",
      categoryLabel: "Database & Data Flow",
      template: {
        defaultFileName: "data_cleaner.py",
        fileType: "python",
        description: "Clean and normalise dictionaries.",
        content: `"""Clean raw data."""
from typing import Any, Mapping


def normalise(record: Mapping[str, Any]) -> dict[str, Any]:
    return {key.strip().lower(): value for key, value in record.items()}
`,
      },
    },
    {
      label: "CSV Importer",
      type: "file",
      badge: "Python",
      description: "Stream CSV files into rows.",
      categoryLabel: "Database & Data Flow",
      template: {
        defaultFileName: "csv_parser.py",
        fileType: "python",
        description: "Yield rows from a CSV file as dictionaries.",
        content: `"""CSV parser."""
import csv
from pathlib import Path
from typing import Dict, Iterator


def read_csv(path: Path) -> Iterator[Dict[str, str]]:
    with path.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            yield row
`,
      },
    },
    {
      label: "Pinecone/FAISS Integration",
      type: "file",
      badge: "Python",
      description: "Vector store adapter functions.",
      categoryLabel: "Database & Data Flow",
      template: {
        defaultFileName: "vector_store.py",
        fileType: "python",
        description: "Wrapper around vector store operations.",
        content: `"""Vector store adaptor."""
from typing import Iterable, Sequence


class VectorStore:
    def __init__(self, client) -> None:
        self._client = client

    async def upsert(self, namespace: str, items: Iterable[tuple[str, Sequence[float], dict]]):
        await self._client.upsert(items=list(items), namespace=namespace)

    async def query(self, namespace: str, vector: Sequence[float], top_k: int = 5):
        return await self._client.query(vector=vector, namespace=namespace, top_k=top_k)
`,
      },
    },
  ],
  devops: [
    {
      label: "Container Builder",
      type: "file",
      badge: "Docker",
      description: "Dockerfile for building the app.",
      categoryLabel: "DevOps & Infra",
      template: {
        defaultFileName: "Dockerfile",
        fileType: "text",
        description: "Two-stage Dockerfile for backend/frontend build.",
        content: `# syntax=docker/dockerfile:1
FROM python:3.11-slim AS base
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
`,
      },
    },
    {
      label: "GitHub Actions Pipeline",
      type: "file",
      badge: "YAML",
      description: "Simple CI pipeline.",
      categoryLabel: "DevOps & Infra",
      template: {
        defaultFileName: "ci_pipeline.yml",
        fileType: "text",
        description: "Install deps, run backend tests and frontend lint.",
        content: `name: CI Pipeline

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: |
          python -m pip install --upgrade pip
          pip install -r backend/requirements.txt
      - run: |
          cd backend
          pytest
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: |
          cd frontend
          npm ci
      - run: |
          cd frontend
          npm run lint
`,
      },
    },
    {
      label: "S3 Upload Function",
      type: "file",
      badge: "Python",
      description: "Upload files to AWS S3.",
      categoryLabel: "DevOps & Infra",
      template: {
        defaultFileName: "aws_s3_uploader.py",
        fileType: "python",
        description: "Upload a local file into S3 bucket.",
        content: `"""Upload files to S3."""
from pathlib import Path

import boto3


def upload_file(bucket: str, key: str, path: Path) -> None:
    boto3.client("s3").upload_file(str(path), bucket, key)
`,
      },
    },
    {
      label: "AWS Lambda Deployer",
      type: "file",
      badge: "Python",
      description: "Update Lambda function code.",
      categoryLabel: "DevOps & Infra",
      template: {
        defaultFileName: "lambda_deploy.py",
        fileType: "python",
        description: "Upload zip artifact to AWS Lambda.",
        content: `"""Deploy AWS Lambda function."""
import boto3


def update_lambda(function_name: str, zip_path: str) -> None:
    with open(zip_path, "rb") as artifact:
        boto3.client("lambda").update_function_code(FunctionName=function_name, ZipFile=artifact.read())
`,
      },
    },
    {
      label: "Prometheus/Health Check",
      type: "file",
      badge: "JavaScript",
      description: "Expose /metrics endpoint for monitoring.",
      categoryLabel: "DevOps & Infra",
      template: {
        defaultFileName: "monitoring_agent.js",
        fileType: "javascript",
        description: "Express server exposing health and metrics.",
        content: `import express from "express"
import client from "prom-client"

client.collectDefaultMetrics()

const app = express()

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType)
  res.end(await client.register.metrics())
})

app.get("/health", (_req, res) => res.json({ status: "ok" }))

app.listen(9100)
`,
      },
    },
    {
      label: "Environment Config Loader",
      type: "file",
      badge: "Python",
      description: "Load infra related config from env.",
      categoryLabel: "DevOps & Infra",
      template: {
        defaultFileName: "config_loader.py",
        fileType: "python",
        description: "Pydantic settings for infrastructure secrets.",
        content: `"""Infrastructure configuration loader."""
from functools import lru_cache

from pydantic import BaseSettings


class InfraSettings(BaseSettings):
    aws_region: str = "us-east-1"
    log_level: str = "INFO"


@lru_cache(maxsize=1)
def get_settings() -> InfraSettings:
    return InfraSettings()
`,
      },
    },
  ],
  "frontend-ui": [
    {
      label: "UI Button Component",
      type: "file",
      badge: "React",
      description: "Reusable button component with variants.",
      categoryLabel: "Frontend / UI",
      template: {
        defaultFileName: "button.tsx",
        fileType: "typescript",
        description: "Client-side button component supporting variant prop.",
        content: `"use client"

import type { ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost"
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const base = variant === "primary" ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"
  return <button className={cn("inline-flex items-center rounded-md px-3 py-2 text-sm", base, className)} {...props} />
}
`,
      },
    },
    {
      label: "Navbar Layout",
      type: "file",
      badge: "React",
      description: "Responsive navbar with links.",
      categoryLabel: "Frontend / UI",
      template: {
        defaultFileName: "navbar.tsx",
        fileType: "typescript",
        description: "Simple navbar component with placeholder links.",
        content: `"use client"

import Link from "next/link"

export function Navbar() {
  return (
    <header className="flex items-center justify-between border-b border-border/40 bg-background/80 px-6 py-4">
      <Link href="/" className="text-lg font-semibold">Nody</Link>
      <nav className="flex items-center gap-4 text-sm text-muted-foreground">
        <Link href="/docs">Docs</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </header>
  )
}
`,
      },
    },
    {
      label: "React Query Hook",
      type: "file",
      badge: "TypeScript",
      description: "Custom hook wrapping TanStack Query.",
      categoryLabel: "Frontend / UI",
      template: {
        defaultFileName: "api_hook.ts",
        fileType: "typescript",
        description: "Fetch JSON data with React Query.",
        content: `import { useQuery } from "@tanstack/react-query"

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("Request failed")
  }
  return response.json()
}

export function useApi<T>(url: string) {
  return useQuery({ queryKey: [url], queryFn: () => fetcher<T>(url) })
}
`,
      },
    },
    {
      label: "Zustand / Redux Store",
      type: "file",
      badge: "TypeScript",
      description: "Global state store using Zustand.",
      categoryLabel: "Frontend / UI",
      template: {
        defaultFileName: "state_store.ts",
        fileType: "typescript",
        description: "Zustand store with basic counter state.",
        content: `import { create } from "zustand"

type State = {
  count: number
  increment: () => void
  reset: () => void
}

export const useCounterStore = create<State>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
}))
`,
      },
    },
    {
      label: "Theme Switcher",
      type: "file",
      badge: "React",
      description: "Toggle light/dark theme.",
      categoryLabel: "Frontend / UI",
      template: {
        defaultFileName: "darkmode_toggle.tsx",
        fileType: "typescript",
        description: "Client component that toggles theme data attribute.",
        content: `"use client"

import { useEffect, useState } from "react"

export function DarkModeToggle() {
  const [theme, setTheme] = useState("light")

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>Toggle theme</button>
}
`,
      },
    },
    {
      label: "Form Validation Logic",
      type: "file",
      badge: "TypeScript",
      description: "Validate form inputs with Zod.",
      categoryLabel: "Frontend / UI",
      template: {
        defaultFileName: "form_validator.ts",
        fileType: "typescript",
        description: "Schema for validating contact form submissions.",
        content: `import { z } from "zod"

export const contactFormSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(10),
})

export type ContactFormValues = z.infer<typeof contactFormSchema>
`,
      },
    },
  ],
  security: [
    {
      label: "JWT Generator",
      type: "file",
      badge: "Python",
      description: "Encode/decode JWT tokens.",
      categoryLabel: "Security & Auth",
      template: {
        defaultFileName: "jwt_encoder.py",
        fileType: "python",
        description: "Generate and validate JWT tokens.",
        content: `"""JWT helpers."""
from datetime import datetime, timedelta, timezone

import jwt


def encode_jwt(subject: str, secret: str, *, expires_in: int = 3600) -> str:
    payload = {"sub": subject, "exp": datetime.now(timezone.utc) + timedelta(seconds=expires_in)}
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_jwt(token: str, secret: str) -> dict:
    return jwt.decode(token, secret, algorithms=["HS256"])
`,
      },
    },
    {
      label: "Bcrypt Hasher",
      type: "file",
      badge: "Python",
      description: "Hash and verify passwords with bcrypt.",
      categoryLabel: "Security & Auth",
      template: {
        defaultFileName: "password_hasher.py",
        fileType: "python",
        description: "Password hashing utilities.",
        content: `"""Password hashing utilities."""
import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())
`,
      },
    },
    {
      label: "Request Rate Limiter",
      type: "file",
      badge: "TypeScript",
      description: "Express middleware for rate limiting.",
      categoryLabel: "Security & Auth",
      template: {
        defaultFileName: "rate_limiter.ts",
        fileType: "typescript",
        description: "Simple in-memory rate limiter middleware.",
        content: `import type { RequestHandler } from "express"

const WINDOW_MS = 60_000
const MAX_REQUESTS = 60
const hits = new Map<string, { count: number; expires: number }>()

export const rateLimiter: RequestHandler = (req, res, next) => {
  const key = req.ip ?? "unknown"
  const now = Date.now()
  const bucket = hits.get(key) ?? { count: 0, expires: now + WINDOW_MS }

  if (bucket.expires < now) {
    bucket.count = 0
    bucket.expires = now + WINDOW_MS
  }

  bucket.count += 1
  hits.set(key, bucket)

  if (bucket.count > MAX_REQUESTS) {
    return res.status(429).json({ error: "Too many requests" })
  }

  next()
}
`,
      },
    },
    {
      label: "OAuth2 Flow",
      type: "file",
      badge: "Python",
      description: "FastAPI dependency for OAuth2 password flow.",
      categoryLabel: "Security & Auth",
      template: {
        defaultFileName: "oauth_handler.py",
        fileType: "python",
        description: "Validate tokens via OAuth2 password flow.",
        content: `"""OAuth2 helpers."""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    if token != "example":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return {"id": "user-1"}
`,
      },
    },
    {
      label: "Security Audit Logger",
      type: "file",
      badge: "Python",
      description: "Structured audit logging helper.",
      categoryLabel: "Security & Auth",
      template: {
        defaultFileName: "audit_logger.py",
        fileType: "python",
        description: "Record security events to stdout as JSON.",
        content: `"""Security audit logging."""
import json
from datetime import datetime, timezone


def log_security_event(event: str, *, actor: str, metadata: dict | None = None) -> None:
    payload = {"event": event, "actor": actor, "timestamp": datetime.now(timezone.utc).isoformat(), "metadata": metadata or {}}
    print(json.dumps(payload))
`,
      },
    },
  ],
  utilities: [
    {
      label: "Logger (Structured Logs)",
      type: "file",
      badge: "Python",
      description: "Configure structured logging for the app.",
      categoryLabel: "Utility / Common",
      template: {
        defaultFileName: "logger.py",
        fileType: "python",
        description: "Setup structlog JSON logging.",
        content: `"""Structured logging config."""
import logging

import structlog


def configure_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(level=level, format="%(message)s")
    structlog.configure(processors=[structlog.processors.JSONRenderer()])
`,
      },
    },
    {
      label: "Environment Variable Loader",
      type: "file",
      badge: "Python",
      description: "Load settings from environment variables.",
      categoryLabel: "Utility / Common",
      template: {
        defaultFileName: "env_loader.py",
        fileType: "python",
        description: "Pydantic BaseSettings wrapper.",
        content: `"""Environment loader."""
from functools import lru_cache
from pydantic import BaseSettings


class Settings(BaseSettings):
    debug: bool = True


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
`,
      },
    },
    {
      label: "File Upload Utility",
      type: "file",
      badge: "Python",
      description: "Save uploaded files to disk.",
      categoryLabel: "Utility / Common",
      template: {
        defaultFileName: "file_uploader.py",
        fileType: "python",
        description: "Persist streaming uploads to filesystem.",
        content: `"""File upload helper."""
from pathlib import Path


def save_upload(contents: bytes, destination: Path) -> Path:
    destination.write_bytes(contents)
    return destination
`,
      },
    },
    {
      label: "Unique ID Generator",
      type: "file",
      badge: "Python",
      description: "Generate UUID4 identifiers.",
      categoryLabel: "Utility / Common",
      template: {
        defaultFileName: "uuid_generator.py",
        fileType: "python",
        description: "Return random UUID strings.",
        content: `"""UUID helpers."""
import uuid


def new_id() -> str:
    return str(uuid.uuid4())
`,
      },
    },
    {
      label: "Retry Decorator",
      type: "file",
      badge: "Python",
      description: "Retry async functions with backoff.",
      categoryLabel: "Utility / Common",
      template: {
        defaultFileName: "retry_wrapper.py",
        fileType: "python",
        description: "Expose retry decorator for async callables.",
        content: `"""Retry decorator."""
import asyncio
from functools import wraps


def retry(*, attempts: int = 3, delay: float = 0.5):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as exc:  # noqa: BLE001
                    last_error = exc
                    await asyncio.sleep(delay * (attempt + 1))
            raise last_error  # type: ignore[misc]

        return wrapper

    return decorator
`,
      },
    },
    {
      label: "Global Error Catcher",
      type: "file",
      badge: "Python",
      description: "FastAPI global exception handler.",
      categoryLabel: "Utility / Common",
      template: {
        defaultFileName: "error_handler.py",
        fileType: "python",
        description: "Register default exception handler for FastAPI.",
        content: `"""Register FastAPI error handlers."""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def default_handler(_: Request, exc: Exception):
        return JSONResponse(status_code=500, content={"error": str(exc)})
`,
      },
    },
    {
      label: "Performance Metrics Collector",
      type: "file",
      badge: "Python",
      description: "Record request latency metrics.",
      categoryLabel: "Utility / Common",
      template: {
        defaultFileName: "metrics_collector.py",
        fileType: "python",
        description: "Prometheus histogram for measuring latency.",
        content: `"""Performance metrics collector."""
from prometheus_client import Histogram

REQUEST_LATENCY = Histogram("app_request_latency_seconds", "Request latency", ["endpoint"])


def observe_latency(endpoint: str, seconds: float) -> None:
    REQUEST_LATENCY.labels(endpoint=endpoint).observe(seconds)
`,
      },
    },
  ],
}

interface LeftSidebarProps {
  selectedNode: string | null
  nodes: FileNode[]
  metadata: Record<string, NodeMetadata>
  onUpdateDescription?: (nodeId: string, description: string) => void
}

export function LeftSidebar({ selectedNode, nodes, metadata, onUpdateDescription }: LeftSidebarProps) {
  const [selectedCategory, setSelectedCategory] = useState("files")
  const [activeTab, setActiveTab] = useState("nodes")

  useEffect(() => {
    if (selectedNode) {
      setActiveTab("inspector")
    }
  }, [selectedNode])

  const handleDragStart = (e: React.DragEvent, nodeData: SidebarNodeTemplate) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ ...nodeData, categoryLabel: nodeData.categoryLabel }),
    )
    e.dataTransfer.setData("application/reactflow", nodeData.type)
    e.dataTransfer.setData("text/plain", nodeData.type)
    e.dataTransfer.effectAllowed = "move"
  }

  return (
    <div className="h-full w-full neu-raised-sm bg-card flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="h-12 flex items-center justify-center border-b border-border">
          <TabsList className="h-8 w-fit neu-inset-sm">
            <TabsTrigger value="nodes" className="data-[state=active]:neu-pressed px-4">
              <FileText className="w-4 h-4 mr-2" />
              Nodes
            </TabsTrigger>
            <TabsTrigger value="inspector" className="data-[state=active]:neu-pressed px-4">
              <Settings className="w-4 h-4 mr-2" />
              Inspector
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="nodes" className="flex-1 overflow-y-auto custom-scrollbar m-0">
          <div className="p-4 border-b border-border">
            <div className="space-y-1">
              {nodeCategories.map((category) => {
                const Icon = category.icon
                const isSelected = selectedCategory === category.id
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all border ${
                      isSelected
                        ? `neu-pressed bg-background ${category.bgColor} ${category.borderColor}`
                        : "neu-raised-sm neu-hover neu-active bg-card border-transparent"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${category.color}`} />
                    <span className="text-sm font-medium text-foreground">{category.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-4 space-y-2">
            {nodeTemplates[selectedCategory]?.map((node) => (
              <div
                key={node.label}
                draggable
                onDragStart={(e) => handleDragStart(e, node)}
                className="neu-raised neu-hover neu-active bg-card p-4 rounded-xl cursor-move transition-all hover:scale-105 border border-border/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${node.template ? "bg-primary" : "bg-muted"}`} />
                    <span className="text-sm font-semibold text-foreground">{node.label}</span>
                  </div>
                  {node.badge ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {node.badge}
                    </span>
                  ) : null}
                </div>
                {node.description ? (
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{node.description}</p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Drag to canvas</p>
                )}
                {node.template ? (
                  <p className="mt-3 text-[11px] font-mono text-muted-foreground">
                    {node.template.defaultFileName}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{node.categoryLabel}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inspector" className="flex-1 overflow-y-auto custom-scrollbar m-0">
          <Inspector selectedNode={selectedNode} nodes={nodes} metadata={metadata} onUpdateDescription={onUpdateDescription} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
