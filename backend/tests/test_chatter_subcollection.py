"""Wave D5 — chatter uses parent_id on root collection (not embedded array)."""
from app.firestore.chatter import ChatterMessageRepository


def test_chatter_collection_is_root_with_parent_id():
    assert ChatterMessageRepository.collection_name == "chatter_messages"
