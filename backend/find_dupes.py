import firebase_admin
from firebase_admin import credentials, firestore
import warnings
warnings.filterwarnings('ignore')

cred = credentials.Certificate('serviceAccountKey.json')
app = firebase_admin.initialize_app(cred)
db = firestore.client()

users = list(db.collection('users').where('email', '==', 'admin@test.com').stream())
print(f'Total users with admin@test.com: {len(users)}')
for u in users:
    d = u.to_dict()
    h = d.get('password_hash', '')
    org = d.get('org_id', '')
    print(f'  ID: {u.id[:8]}... hash_prefix: {h[:20]}... org: {org[:8]}...')
