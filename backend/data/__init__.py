"""
In-memory data storage for Phase 2

This module contains simple dictionaries to store data in memory.
In a production system, this would be replaced with a database.
"""

from .storage import (
    groups_storage,
    expenses_storage,
    users_storage,
    generate_group_id,
    generate_expense_id,
    generate_invite_code,
    get_user_name,
)

__all__ = [
    "groups_storage",
    "expenses_storage",
    "users_storage",
    "generate_group_id",
    "generate_expense_id",
    "generate_invite_code",
    "get_user_name",
]
