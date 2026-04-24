# Utils init


def escape_like(s: str) -> str:
    """Escape special SQL LIKE wildcard characters in search input."""
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
