from fastapi import FastAPI
from pydantic import BaseModel
from task import perform_search_task, process_user_response
import subprocess

app = FastAPI()

class SearchRequest(BaseModel):
    query: str
    chat_id: int

class UserResponseRequest(BaseModel):
    text: str
    chat_id: int

@app.post("/search")
async def search(request: SearchRequest):
    result = perform_search_task(request.query, request.chat_id)
    return {"status": "queued", "message": f"Searching '{request.query}' in background"}

@app.post("/response")
async def handle_response(request: UserResponseRequest):
    """Handle user responses for the interactive search process"""
    result = process_user_response(request.chat_id, request.text)
    return {"status": "processed", "message": "User response processed"}
@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/update-domains")
async def update_domains():
    try:
        subprocess.run(["python", "cron_job.py"], check=True)
        return {"status": "updated"}
    except Exception as e:
        return {"status": "error", "message": str(e)}