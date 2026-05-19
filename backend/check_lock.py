import firebase_admin
from firebase_admin import credentials, firestore
import os

cred_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'serviceAccountKey.json')
cred = credentials.Certificate(cred_path)
app = firebase_admin.initialize_app(cred)
db = firestore.client()

users = list(db.collection('users').where('email', '==', 'admin@test.com').limit(1).stream())
u = users[0]
d = u.to_dict()
print("Full user data:")
for k, v in d.items():
    if k != 'password_hash':
        print(f"  {k}: {v!r}")
