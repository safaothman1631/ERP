"""Trace the exact login flow as the backend does it."""
import firebase_admin
from firebase_admin import credentials, firestore
import bcrypt
import warnings
warnings.filterwarnings('ignore')

cred = credentials.Certificate('serviceAccountKey.json')
app = firebase_admin.initialize_app(cred)
db = firestore.client()

email = 'admin@test.com'
password = 'Admin@123456'

print("=== Tracing login flow ===\n")

# Step 1: Query users collection (exactly as backend does)
print("1. Querying db.collection('users').where('email', '==', email)...")
users_ref = db.collection('users').where('email', '==', email).limit(1).stream()
user_data = None
for doc in users_ref:
    user_data = {'id': doc.id, **doc.to_dict()}
    break

if not user_data:
    print("   ❌ User NOT found!")
else:
    print(f"   ✅ Found: {user_data['id'][:8]}...")
    print(f"   org_id: {user_data.get('org_id')}")
    print(f"   is_active: {user_data.get('is_active')!r}")
    print(f"   auth_provider: {user_data.get('auth_provider')!r}")
    
    # Step 2: Check auth_provider
    if user_data.get('auth_provider') == 'google' and not user_data.get('password_hash'):
        print("   ❌ Google-only user, no password!")
    else:
        print("   ✅ Has password_hash")
    
    # Step 3: Check locked_until
    locked_until = user_data.get('locked_until')
    print(f"\n2. locked_until: {locked_until!r} (type: {type(locked_until).__name__})")
    
    # Step 4: Verify password
    stored_hash = user_data.get('password_hash', '')
    print(f"\n3. Verifying password...")
    print(f"   stored_hash[:20]: {stored_hash[:20]}...")
    print(f"   password: {password!r}")
    
    try:
        result = bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
        print(f"   bcrypt.checkpw result: {'✅ MATCH' if result else '❌ NO MATCH'}")
    except Exception as e:
        print(f"   ❌ bcrypt error: {e}")
    
    # Step 5: Check org
    org_id = user_data.get('org_id', '')
    print(f"\n4. Checking org: {org_id}")
    org_doc = db.collection('organizations').document(org_id).get()
    print(f"   Org exists: {org_doc.exists}")
    if org_doc.exists:
        print(f"   Org name: {org_doc.to_dict().get('name')}")
