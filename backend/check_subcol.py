"""Check if users are stored in subcollections."""
import firebase_admin
from firebase_admin import credentials, firestore
import warnings
warnings.filterwarnings('ignore')

cred = credentials.Certificate('serviceAccountKey.json')
app = firebase_admin.initialize_app(cred)
db = firestore.client()

# Check global users collection
print("=== Global users collection ===")
users = list(db.collection('users').limit(5).stream())
print(f"Count: {len(users)}")
for u in users:
    d = u.to_dict()
    print(f"  {u.id[:8]}... email={d.get('email')} org={d.get('org_id', '')[:8]}...")

# Check organizations
print("\n=== Organizations ===")
orgs = list(db.collection('organizations').limit(5).stream())
print(f"Count: {len(orgs)}")
for o in orgs:
    d = o.to_dict()
    print(f"  {o.id[:8]}... name={d.get('name')}")
    
    # Check if org has users subcollection
    sub_users = list(db.collection('organizations').document(o.id).collection('users').limit(3).stream())
    if sub_users:
        print(f"    Has users subcollection: {len(sub_users)} users")
        for u in sub_users:
            ud = u.to_dict()
            print(f"      {u.id[:8]}... email={ud.get('email')}")
