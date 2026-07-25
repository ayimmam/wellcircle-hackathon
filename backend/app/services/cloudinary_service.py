"""Validated Cloudinary uploads for certificates and receipts."""
import io

import cloudinary
import cloudinary.uploader

from app.config import settings

FOLDER_RULES = {
    "certificates": {
        "max_size": 10 * 1024 * 1024,
        "content_types": {"application/pdf", "image/jpeg", "image/png"},
    },
    "receipts": {
        "max_size": 5 * 1024 * 1024,
        "content_types": {"image/jpeg", "image/png"},
    },
}


def _configure():
    if not all((settings.CLOUDINARY_CLOUD_NAME, settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET)):
        raise RuntimeError("Cloudinary is not configured")
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def upload_file(file_bytes, folder, content_type):
    rules = FOLDER_RULES.get(folder)
    if not rules:
        raise ValueError("Unsupported upload folder")
    if content_type not in rules["content_types"]:
        raise ValueError("Unsupported file type")
    if len(file_bytes) > rules["max_size"]:
        raise ValueError("File is too large")
    if not file_bytes:
        raise ValueError("File is empty")
    _configure()
    resource_type = "raw" if content_type == "application/pdf" else "image"
    result = cloudinary.uploader.upload(
        io.BytesIO(file_bytes), folder=f"wellcircle/{folder}", resource_type=resource_type
    )
    return {"url": result["secure_url"], "public_id": result["public_id"]}


def delete_file(public_id, resource_type="image"):
    _configure()
    return cloudinary.uploader.destroy(public_id, resource_type=resource_type)
