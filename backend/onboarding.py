"""
Onboarding chat functionality using Groq API.
"""
import json
from datetime import datetime
from typing import Dict, Any, Optional, List

import httpx
from fastapi import HTTPException

from config import GROQ_API_KEY, GROQ_API_URL, GROQ_MODEL, ONBOARDING_SYSTEM_PROMPT, PROJECT_SPEC_PATH
from utils import extract_structured_payload


class OnboardingService:
    """Handles project specification gathering through conversational interface."""
    
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}
    
    async def invoke_groq(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Send the conversation to Groq's chat completions API and return the response JSON."""
        if not GROQ_API_KEY:
            raise HTTPException(status_code=503, detail="Groq API key not configured")

        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": GROQ_MODEL,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1600,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(GROQ_API_URL, headers=headers, json=payload)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Groq API request failed: {exc}") from exc

        if response.status_code >= 400:
            try:
                error_payload = response.json()
                error_detail = error_payload.get("error", error_payload)
            except json.JSONDecodeError:
                error_detail = response.text
            raise HTTPException(status_code=502, detail=f"Groq API error: {error_detail}")

        try:
            return response.json()
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=502, detail="Groq API returned invalid JSON") from exc
    
    def load_project_spec_document(self) -> Optional[Dict[str, Any]]:
        """Load the persisted project specification document if it exists."""
        if not PROJECT_SPEC_PATH.exists():
            return None
        try:
            return json.loads(PROJECT_SPEC_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            print(f"Error reading project spec: {exc}")
            return None
    
    def persist_project_spec(self, session_id: str, project_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Persist the project specification to disk with basic metadata."""
        document = {
            "session_id": session_id,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "model": GROQ_MODEL,
            "project_spec": project_spec,
        }
        try:
            PROJECT_SPEC_PATH.write_text(json.dumps(document, indent=2, ensure_ascii=False), encoding="utf-8")
        except OSError as exc:
            print(f"Error writing project spec: {exc}")
            raise HTTPException(status_code=500, detail="Failed to persist project specification") from exc
        return document
    
    async def process_chat(self, session_id: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Process onboarding chat conversation."""
        if not messages:
            raise HTTPException(status_code=400, detail="Messages cannot be empty")

        # Build conversation payload for Groq
        groq_messages = [{"role": "system", "content": ONBOARDING_SYSTEM_PROMPT}]
        for message in messages:
            if message["role"] == "system":
                continue  # System prompt managed internally
            groq_messages.append({"role": message["role"], "content": message["content"]})

        groq_response = await self.invoke_groq(groq_messages)

        try:
            assistant_content = groq_response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise HTTPException(status_code=502, detail="Groq API returned an unexpected payload") from exc

        payload = extract_structured_payload(assistant_content)
        required_keys = {"assistant_message", "status", "missing_information", "project_spec"}
        if not required_keys.issubset(payload):
            raise HTTPException(status_code=502, detail="Groq response missing required fields")

        status = payload["status"]
        if status not in ("collecting", "ready"):
            raise HTTPException(status_code=502, detail="Groq response contained invalid status")

        assistant_message = str(payload["assistant_message"])
        missing_information_raw = payload.get("missing_information") or []
        if isinstance(missing_information_raw, list):
            missing_information = [str(item) for item in missing_information_raw]
        else:
            missing_information = [str(missing_information_raw)]

        project_spec = payload.get("project_spec")
        spec_saved = False

        if status == "ready":
            if not isinstance(project_spec, dict):
                raise HTTPException(status_code=502, detail="Groq response missing project_spec details")
            self.persist_project_spec(session_id, project_spec)
            spec_saved = True
        else:
            project_spec = None

        self.sessions[session_id] = {
            "status": status,
            "missing_information": missing_information,
            "project_spec": project_spec,
            "assistant_message": assistant_message,
        }

        return {
            "message": assistant_message,
            "status": status,
            "missing_information": missing_information,
            "project_spec": project_spec,
            "spec_saved": spec_saved,
        }
    
    def get_project_spec(self) -> Dict[str, Any]:
        """Return the persisted project specification if it exists."""
        document = self.load_project_spec_document()
        if not document:
            return {"exists": False}

        metadata = {
            "session_id": document.get("session_id"),
            "generated_at": document.get("generated_at"),
            "model": document.get("model"),
        }

        return {
            "exists": True,
            "project_spec": document.get("project_spec"),
            "metadata": metadata,
        }


# Global instance
onboarding_service = OnboardingService()
