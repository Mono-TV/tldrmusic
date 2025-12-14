"""
Rank History API Routes - For managing chart position history
"""
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ...services.rank_history import rank_history

router = APIRouter(prefix="/rank-history", tags=["Rank History"])


class SnapshotEntry(BaseModel):
    rank: int
    title: str
    artist: str
    song_id: Optional[str] = None


class RecordSnapshotRequest(BaseModel):
    chart_type: str  # 'india', 'global', 'regional_tamil', etc.
    entries: List[SnapshotEntry]
    snapshot_date: Optional[str] = None  # ISO format YYYY-MM-DD


class RankChangeResponse(BaseModel):
    direction: str
    positions: int
    previous_rank: Optional[int]
    is_new: bool


@router.post("/snapshot")
async def record_snapshot(request: RecordSnapshotRequest):
    """
    Record a chart snapshot for rank tracking.

    Call this endpoint after each chart update to record positions.
    """
    snapshot_date = None
    if request.snapshot_date:
        try:
            snapshot_date = date.fromisoformat(request.snapshot_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    entries = [
        {
            "rank": e.rank,
            "title": e.title,
            "artist": e.artist,
            "song_id": e.song_id
        }
        for e in request.entries
    ]

    rank_history.record_snapshot(
        chart_type=request.chart_type,
        entries=entries,
        snapshot_date=snapshot_date
    )

    return {
        "status": "success",
        "chart_type": request.chart_type,
        "date": (snapshot_date or date.today()).isoformat(),
        "entries_recorded": len(entries)
    }


@router.get("/dates/{chart_type}")
async def get_history_dates(chart_type: str):
    """
    Get list of dates with recorded history for a chart type.
    """
    dates = rank_history.get_history_dates(chart_type)
    return {
        "chart_type": chart_type,
        "dates": dates,
        "count": len(dates)
    }


@router.get("/change/{chart_type}")
async def get_rank_change(
    chart_type: str,
    title: str = Query(..., description="Song title"),
    artist: str = Query(..., description="Artist name"),
    current_rank: int = Query(..., description="Current rank"),
    current_date: Optional[str] = Query(None, description="Current date (YYYY-MM-DD)")
):
    """
    Calculate rank change for a specific song.
    """
    cd = None
    if current_date:
        try:
            cd = date.fromisoformat(current_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")

    change = rank_history.calculate_rank_change(
        chart_type=chart_type,
        title=title,
        artist=artist,
        current_rank=current_rank,
        current_date=cd
    )

    return RankChangeResponse(**change)


@router.delete("/{chart_type}")
async def clear_history(chart_type: str):
    """
    Clear history for a specific chart type (admin only - for testing).
    """
    rank_history.clear_history(chart_type)
    return {"status": "success", "message": f"Cleared history for {chart_type}"}
