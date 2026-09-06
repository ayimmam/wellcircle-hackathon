from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.dependencies import get_current_user
from app.models.user import User
from app.services.cloudinary_service import upload_file

router = APIRouter()


@router.post("/uploads")
async def upload(
    folder: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    try:
        return upload_file(await file.read(), folder, file.content_type or "")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Upload failed: {str(exc)}")
