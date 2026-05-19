import sys, os

# Set env vars BEFORE importing any app modules
os.environ['ENVIRONMENT'] = 'development'
os.environ['DATABASE_URL'] = 'sqlite:///./test.db'
os.environ['SECRET_KEY'] = 'dev-only-insecure-key-change-me-in-production'
os.environ['CORS_ORIGINS'] = 'http://localhost:5173'
os.environ['FIREBASE_CREDENTIALS_PATH'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'serviceAccountKey.json')

sys.path.insert(0, '.')

# Initialize Firebase directly
import firebase_admin
from firebase_admin import credentials, firestore

cred_path = os.environ['FIREBASE_CREDENTIALS_PATH']
print(f"Using credentials: {cred_path}")
print(f"File exists: {os.path.exists(cred_path)}")

cred = credentials.Certificate(cred_path)
app = firebase_admin.initialize_app(cred)
db = firestore.client()

users = list(db.collection('users').limit(20).stream())
print(f'Total users: {len(users)}')
for u in users:
    d = u.to_dict()
    locked = d.get('locked_until')
    failed = d.get('failed_login_attempts', 0)
    print(f"  ID: {u.id[:8]}... Email: {d.get('email')} Role: {d.get('role')} Active: {d.get('is_active')} Locked: {locked} Failed: {failed}")
