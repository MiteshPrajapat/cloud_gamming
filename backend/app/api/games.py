import json
import os
import shutil
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form

from backend.app.config import settings
from backend.app.models.game import Game, GameCreate, GameUpdate
from backend.app.core.security import validate_safe_filename, safe_extract_archive

router = APIRouter(prefix="/api/games", tags=["Games"])

def load_games_from_disk() -> List[Game]:
    """Loads dynamic game library from games_data.json"""
    if not settings.games_data_file.exists():
        return []
    try:
        with open(settings.games_data_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return [Game(**item) for item in data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read games database: {e}")

def save_games_to_disk(games: List[Game]):
    """Persists game list to games_data.json"""
    try:
        with open(settings.games_data_file, "w", encoding="utf-8") as f:
            json.dump([g.dict() for g in games], f, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save games database: {e}")

@router.get("", response_model=List[Game])
async def list_games(
    search: Optional[str] = Query(None, description="Search by title or description"),
    category: Optional[str] = Query(None, description="Filter by genre"),
    game_type: Optional[str] = Query(None, description="Filter by engine (linux, windows, retro)"),
    featured_only: bool = Query(False, description="Return featured games only")
):
    games = load_games_from_disk()

    if search:
        s = search.lower()
        games = [g for g in games if s in g.name.lower() or s in g.description.lower()]

    if category and category.lower() != "all":
        games = [g for g in games if g.category.lower() == category.lower()]

    if game_type and game_type.lower() != "all":
        games = [g for g in games if g.game_type.lower() == game_type.lower()]

    if featured_only:
        games = [g for g in games if g.featured]

    return games

@router.get("/categories", response_model=List[str])
async def list_categories():
    games = load_games_from_disk()
    categories = sorted(list(set(g.category for g in games)))
    return ["All"] + categories

@router.get("/{game_id}", response_model=Game)
async def get_game(game_id: str):
    games = load_games_from_disk()
    for g in games:
        if g.id == game_id:
            return g
    raise HTTPException(status_code=404, detail=f"Game '{game_id}' not found.")

@router.post("", response_model=Game, status_code=201)
async def create_game(payload: GameCreate):
    games = load_games_from_disk()
    if any(g.id == payload.id for g in games):
        raise HTTPException(status_code=400, detail=f"Game with ID '{payload.id}' already exists.")

    new_game = Game(**payload.dict(), is_installed=True, status="ready")
    games.append(new_game)
    save_games_to_disk(games)
    return new_game

@router.put("/{game_id}", response_model=Game)
async def update_game(game_id: str, payload: GameUpdate):
    games = load_games_from_disk()
    target_idx = None
    for idx, g in enumerate(games):
        if g.id == game_id:
            target_idx = idx
            break

    if target_idx is None:
        raise HTTPException(status_code=404, detail="Game not found.")

    curr = games[target_idx].dict()
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    curr.update(update_data)
    updated_game = Game(**curr)
    games[target_idx] = updated_game
    save_games_to_disk(games)
    return updated_game

@router.delete("/{game_id}")
async def delete_game(game_id: str):
    games = load_games_from_disk()
    filtered = [g for g in games if g.id != game_id]
    if len(filtered) == len(games):
        raise HTTPException(status_code=404, detail="Game not found.")

    save_games_to_disk(filtered)
    # If game had an uploaded directory, clean it up
    game_folder = settings.games_dir / game_id
    if game_folder.exists() and game_folder.is_dir():
        shutil.rmtree(game_folder, ignore_errors=True)

    return {"message": f"Game '{game_id}' successfully removed."}

@router.post("/upload")
async def upload_game_archive(
    game_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Secure archive upload with path traversal prevention.
    Extracts into games/<game_id>/ directory.
    """
    safe_filename = validate_safe_filename(file.filename or "game_archive.zip")
    target_dir = settings.games_dir / game_id
    target_dir.mkdir(parents=True, exist_ok=True)
    temp_archive = target_dir / safe_filename

    try:
        with open(temp_archive, "wb") as f:
            while chunk := await file.read(1024 * 1024): # 1MB chunks
                f.write(chunk)

        safe_extract_archive(temp_archive, target_dir)
    finally:
        if temp_archive.exists():
            temp_archive.unlink(missing_ok=True)

    return {
        "message": f"Successfully extracted archive for game '{game_id}'",
        "install_dir": str(target_dir)
    }

