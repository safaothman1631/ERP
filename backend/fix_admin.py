import sys, os
import firebase_admin
from firebase_admin import credentials, firestore
import bcrypt

cred_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'serviceAccountKey.json')
cred = credentials.Certificate(cred_path)
app = firebase_admin.initialize_app(cred)
db = firestore.client()

# Find admin@test.com
users = list(db.collection('users').where('email', '==', 'admin@test.com').limit(1).stream())
if not users:
    print("admin@test.com not found!")
else:
    u = users[0]
    d = u.to_dict()
    print(f"Found: {u.id} - Active: {d.get('is_active')} - org_id: {d.get('org_id')}")
    
    # Set new password: Admin@123456
    new_password = 'Admin@123456'
    new_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    
    # Fix is_active and reset password
    db.collection('users').document(u.id).update({
        'is_active': True,
        'password_hash': new_hash,
        'failed_login_attempts': 0,
        'locked_until': None,
    })
    print(f"Updated admin@test.com: is_active=True, new password=Admin@123456")
    print(f"org_id: {d.get('org_id')}")
