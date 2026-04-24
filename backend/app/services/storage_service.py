# Firebase Storage service
from app.firebase_client import get_bucket
from datetime import timedelta
import io, uuid, os

class StorageService:
    """Service for Firebase Cloud Storage operations"""
    
    def __init__(self, org_id: str):
        self.org_id = org_id
        self.bucket = get_bucket()
    
    def upload_file(self, file_data: bytes, filename: str, folder: str, 
                    content_type: str = "application/octet-stream") -> str:
        """Upload file to storage and return path"""
        path = f"{self.org_id}/{folder}/{filename}"
        blob = self.bucket.blob(path)
        blob.upload_from_string(file_data, content_type=content_type)
        return path
    
    def upload_pdf(self, pdf_bytes: bytes, entity_type: str, entity_id: str) -> str:
        """Upload PDF document"""
        filename = f"{entity_id}.pdf"
        return self.upload_file(pdf_bytes, filename, f"pdfs/{entity_type}", "application/pdf")
    
    def upload_attachment(self, file_data: bytes, filename: str, 
                          entity_type: str, entity_id: str, content_type: str) -> str:
        """Upload attachment file"""
        safe_name = f"{uuid.uuid4().hex[:8]}_{filename}"
        return self.upload_file(file_data, safe_name, 
                               f"attachments/{entity_type}/{entity_id}", content_type)
    
    def upload_logo(self, file_data: bytes, filename: str, content_type: str) -> str:
        """Upload organization logo"""
        ext = os.path.splitext(filename)[1]
        return self.upload_file(file_data, f"logo{ext}", "logos", content_type)
    
    def download_file(self, path: str) -> bytes:
        """Download file from storage"""
        blob = self.bucket.blob(path)
        return blob.download_as_bytes()
    
    def get_signed_url(self, path: str, expires_minutes: int = 60) -> str:
        """Generate signed URL for temporary access"""
        blob = self.bucket.blob(path)
        return blob.generate_signed_url(expiration=timedelta(minutes=expires_minutes))
    
    def delete_file(self, path: str):
        """Delete file from storage"""
        blob = self.bucket.blob(path)
        if blob.exists():
            blob.delete()
    
    def list_files(self, folder: str) -> list:
        """List all files in a folder"""
        prefix = f"{self.org_id}/{folder}/"
        blobs = self.bucket.list_blobs(prefix=prefix)
        return [{"name": b.name, "size": b.size, "updated": b.updated} for b in blobs]
