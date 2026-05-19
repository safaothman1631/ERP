"""Check exact bytes of stored password hash."""
import firebase_admin
from firebase_admin import credentials, firestore
import bcrypt
import warnings
warnings.filterwarnings('ignore')

cred = credentials.Certificate('serviceAccountKey.json')
app = firebase_admin.initialize_app(cred)
db = firestore.client()

users = list(db.collection('users').where('email', '==', 'admin@test.com').limit(1).stream())
u = users[0]
d = u.to_dict()
stored = d.get('password_hash', '')

print(f"Hash length: {len(stored)}")
print(f"Hash repr: {stored!r}")
print(f"Hash bytes: {stored.encode('utf-8')[:30]}")

# Test with exact bytes
pw = 'Admin@123456'
try:
    result = bcrypt.checkpw(pw.encode('utf-8'), stored.encode('utf-8'))
    print(f"checkpw result: {result}")
except Exception as e:
    print(f"checkpw error: {e}")

# Try stripping
stored_stripped = stored.strip()
if stored_stripped != stored:
    print(f"WARNING: hash has leading/trailing whitespace!")
    result2 = bcrypt.checkpw(pw.encode('utf-8'), stored_stripped.encode('utf-8'))
    print(f"checkpw with stripped hash: {result2}")
