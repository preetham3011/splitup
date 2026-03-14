"""
In-memory storage implementation with MongoDB read/write support

Phase 4.1: Added MongoDB read operations with fallback to in-memory storage.
Phase 4.2: Added MongoDB write mirroring (fire-and-forget).
Phase 4.3: Made MongoDB writes explicit and awaited (no fire-and-forget).
"""

import os
import random
import string
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from bson import ObjectId
from decimal import Decimal, ROUND_HALF_UP

from dotenv import load_dotenv
import os

load_dotenv()


# MongoDB imports (guarded to allow running without motor installed)
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
    MONGO_AVAILABLE = True
except ImportError:
    AsyncIOMotorClient = None  # type: ignore
    ConnectionFailure = ServerSelectionTimeoutError = Exception  # type: ignore
    MONGO_AVAILABLE = False
    print("WARNING: motor not available, MongoDB features disabled")

# In-memory storage dictionaries (instances defined after helper classes)
groups_storage: Dict[str, dict]
expenses_storage: Dict[str, dict]
# Note: budgets_storage removed - budgets are MongoDB-only (Phase 5)
# Simple user lookup (in production, this would come from auth system)
users_storage: Dict[str, dict] = {
    "user_123": {"id": "user_123", "name": "Test User", "email": "test@example.com"}
}

# MongoDB connection (initialized on first use)
_mongo_client: Optional[AsyncIOMotorClient] = None
_mongo_db = None
_mongo_connected = False


def _init_mongo_connection():
    """Initialize MongoDB connection if available"""
    global _mongo_client, _mongo_db, _mongo_connected
    
    if not MONGO_AVAILABLE:
        return False
    
    if _mongo_client is not None:
        return _mongo_connected
    
    try:
        mongo_url = os.getenv("MONGO_URL")
        db_name = os.getenv("DB_NAME", "splitup")
        
        if not mongo_url:
            print("MongoDB: MONGO_URL not set, using in-memory storage only")
            return False
        
        _mongo_client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        _mongo_db = _mongo_client[db_name]
        _mongo_connected = True
        print(f"MongoDB: Connected to database '{db_name}'")
        return True
    except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
        print(f"MongoDB: Connection failed ({type(e).__name__}), using in-memory storage: {e}")
        _mongo_connected = False
        return False


def _convert_mongo_doc_to_dict(doc: dict) -> dict:
    """Convert MongoDB document to regular dict, handling ObjectId and datetime"""
    if doc is None:
        return None
    
    result = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value
        elif isinstance(value, dict):
            result[key] = _convert_mongo_doc_to_dict(value)
        elif isinstance(value, list):
            result[key] = [
                _convert_mongo_doc_to_dict(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[key] = value
    
    return result


# ============================================================================
# MongoDB WRITE OPERATIONS (Phase 4.3 - Explicit, Awaited)
# ============================================================================

async def create_group_in_mongo(group: dict) -> None:
    """
    Create a group in MongoDB (EXPLICIT, AWAITED).
    Fails loudly if MongoDB write fails.
    Also inserts group members into group_members collection.
    """
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        raise RuntimeError("MongoDB connection not available - cannot create group")
    
    if not group:
        raise ValueError("Group data is required")
    
    groups_collection = _mongo_db.groups
    group_members_collection = _mongo_db.group_members

    group_id = group.get("id")
    if not group_id:
        raise ValueError("Group ID is required")
    
    members = group.get("members", [])
    members_list = [dict(m) for m in members]

    group_doc = dict(group)
    group_doc["members"] = members_list

    # Insert group (will create collection if it doesn't exist)
    await groups_collection.insert_one(group_doc)
    print(f"MongoDB: Insert group OK: {group_id}")

    # Insert each member into group_members collection
    for member in members_list:
        member_doc = {**member, "group_id": group_id}
        await group_members_collection.insert_one(member_doc)
    print(f"MongoDB: Insert {len(members_list)} members OK for group {group_id}")


async def add_member_to_group_in_mongo(group_id: str, member: dict) -> None:
    """
    Add a member to a group in MongoDB (EXPLICIT, AWAITED).
    Fails loudly if MongoDB write fails.
    """
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        raise RuntimeError("MongoDB connection not available - cannot add member")
    
    if not group_id or not member:
        raise ValueError("Group ID and member data are required")
    
    user_id = member.get("user_id")
    if not user_id:
        raise ValueError("Member user_id is required")
    
    group_members_collection = _mongo_db.group_members
    member_doc = {**member, "group_id": group_id}
    
    # Insert member (will create collection if it doesn't exist)
    await group_members_collection.insert_one(member_doc)
    print(f"MongoDB: Insert member OK: {user_id} in group {group_id}")
    
    # Also update the group document's members array
    groups_collection = _mongo_db.groups
    await groups_collection.update_one(
        {"id": group_id},
        {"$push": {"members": member}}
    )
    print(f"MongoDB: Updated group {group_id} members array")


async def create_expense_in_mongo(expense: dict) -> None:
    """
    Create an expense in MongoDB (EXPLICIT, AWAITED).
    Fails loudly if MongoDB write fails.
    """
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        raise RuntimeError("MongoDB connection not available - cannot create expense")
    
    if not expense:
        raise ValueError("Expense data is required")
    
    expense_id = expense.get("id")
    if not expense_id:
        raise ValueError("Expense ID is required")
    
    expenses_collection = _mongo_db.expenses
    expense_doc = dict(expense)
    
    # Insert expense (will create collection if it doesn't exist)
    await expenses_collection.insert_one(expense_doc)
    print(f"MongoDB: Insert expense OK: {expense_id} for group {expense_doc.get('group_id')}")


# ============================================================================
# MongoDB BUDGET OPERATIONS (Phase 5 - MongoDB Only, No In-Memory Fallback)
# ============================================================================

async def create_or_update_budget(budget: dict) -> dict:
    """
    Create or update a budget in MongoDB (EXPLICIT, AWAITED, MongoDB-ONLY).
    Fails loudly if MongoDB write fails.
    
    Expects budget dict to contain: group_id, category, limit.
    Generates id if not provided.
    Sets created_at/updated_at timestamps.
    """
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        raise RuntimeError("MongoDB connection not available - cannot create/update budget")
    
    if not budget:
        raise ValueError("Budget data is required")
    
    category = budget.get("category")
    if not category:
        raise ValueError("Budget category is required")
    
    limit = budget.get("limit")
    if limit is None:
        raise ValueError("Budget limit is required")
    
    # Generate ID if not provided
    if "id" not in budget or not budget.get("id"):
        budget["id"] = generate_budget_id()
        # For new budgets we must know which group this belongs to
        group_id = budget.get("group_id")
        if not group_id:
            raise ValueError("Budget group_id is required")
    else:
        # For updates, group_id is optional because it is already stored in MongoDB.
        group_id = budget.get("group_id")
    
    budget_id = budget["id"]
    
    budgets_collection = _mongo_db.budgets
    budget_doc = dict(budget)
    
    # Ensure timestamps
    now = datetime.now()
    if "created_at" not in budget_doc:
        budget_doc["created_at"] = now
    budget_doc["updated_at"] = now
    
    # Upsert budget (will create collection if it doesn't exist)
    await budgets_collection.update_one(
        {"id": budget_id},
        {"$set": budget_doc},
        upsert=True,
    )
    print(f"MongoDB: Upsert budget OK: {budget_id} for group {group_id}, category {category}")
    
    return budget_doc


async def delete_budget(budget_id: str) -> None:
    """
    Delete a budget from MongoDB (EXPLICIT, AWAITED, MongoDB-ONLY).
    Fails loudly if MongoDB write fails.
    """
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        raise RuntimeError("MongoDB connection not available - cannot delete budget")
    
    if not budget_id:
        raise ValueError("Budget ID is required")
    
    budgets_collection = _mongo_db.budgets
    
    # Delete budget (will create collection if it doesn't exist, but delete will be no-op)
    result = await budgets_collection.delete_one({"id": budget_id})
    if result.deleted_count > 0:
        print(f"MongoDB: Delete budget OK: {budget_id}")
    else:
        print(f"MongoDB: Budget {budget_id} not found for deletion")

# Instantiate storage as regular dicts (no auto-mirroring)
groups_storage: Dict[str, dict] = {}
expenses_storage: Dict[str, dict] = {}
# Note: budgets_storage removed - budgets are MongoDB-only (Phase 5)

def generate_group_id() -> str:
    """Generate a unique group ID"""
    return f"group_{random.randint(1000, 9999)}"


def generate_expense_id() -> str:
    """Generate unique expense ID"""
    return f"expense_{''.join(random.choices(string.ascii_lowercase + string.digits, k=8))}"


def generate_settlement_id() -> str:
    """Generate unique settlement ID"""
    return f"settlement_{''.join(random.choices(string.ascii_lowercase + string.digits, k=8))}"


def generate_budget_id() -> str:
    """Generate a unique budget ID"""
    return f"budget_{random.randint(10000, 99999)}"


def generate_invite_code() -> str:
    """
    Generate a unique invite code in format: XXXX-XX
    Example: X8J2-9K
    """
    while True:
        # Generate format: 4 alphanumeric chars - 2 alphanumeric chars
        part1 = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        part2 = ''.join(random.choices(string.ascii_uppercase + string.digits, k=2))
        code = f"{part1}-{part2}"
        
        # Check if code already exists
        if not any(group.get("invite_code") == code for group in groups_storage.values()):
            return code


async def get_user_name(user_id: str) -> str:
    """
    Get user name by user_id. Fetches from MongoDB users collection (async).
    Returns 'Unknown user' if not found (never returns raw user_id).
    """
    if not user_id:
        return "Unknown user"
    
    # Try MongoDB first
    if _mongo_db is not None:
        try:
            users_collection = _mongo_db.users
            user_doc = await users_collection.find_one({"id": user_id})
            if user_doc:
                return user_doc.get("name", "Unknown user")
        except Exception as e:
            print(f"Error fetching user name from MongoDB for {user_id}: {e}")
    
    # Fallback to in-memory
    user = users_storage.get(user_id)
    if user:
        return user.get("name", "Unknown user")
    
    return "Unknown user"


def add_user(user_id: str, name: str, email: Optional[str] = None):
    """Add a user to the storage (called when user joins a group)"""
    if user_id not in users_storage:
        users_storage[user_id] = {
            "id": user_id,
            "name": name,
            "email": email or f"{user_id}@example.com"
        }


# ============================================================================
# MongoDB READ OPERATIONS (Phase 4.1)
# ============================================================================

async def get_groups_for_user(user_id: str) -> List[dict]:
    """
    Get all groups where the user is a member (READ ONLY)
    
    Tries MongoDB first, falls back to in-memory storage if MongoDB has no data.
    Returns list of group dicts in the same format as groups_storage.
    """
    # Try MongoDB first
    if _init_mongo_connection() and _mongo_db is not None:
        try:
            # Query groups where user is in members array
            groups_collection = _mongo_db.groups
            cursor = groups_collection.find({"members.user_id": user_id})
            mongo_groups = await cursor.to_list(length=None)
            
            if mongo_groups:
                print(f"MongoDB: Found {len(mongo_groups)} groups for user {user_id}")
                # Convert MongoDB documents to dicts
                result = []
                for doc in mongo_groups:
                    group_dict = _convert_mongo_doc_to_dict(doc)
                    # Ensure 'id' field exists (use _id if id not present)
                    if "_id" in group_dict and "id" not in group_dict:
                        group_dict["id"] = str(group_dict.pop("_id"))
                    result.append(group_dict)
                return result
            else:
                print(f"MongoDB: No groups found for user {user_id}, falling back to in-memory")
        except Exception as e:
            print(f"MongoDB: Error reading groups for user {user_id}: {e}, falling back to in-memory")
    
    # Fallback to in-memory storage
    user_groups = []
    for group in groups_storage.values():
        is_member = any(
            member.get("user_id") == user_id 
            for member in group.get("members", [])
        )
        if is_member:
            user_groups.append(group)
    
    return user_groups


async def get_group_by_id(group_id: str) -> Optional[dict]:
    """
    Get a single group by ID (READ ONLY)
    
    Tries MongoDB first, falls back to in-memory storage if MongoDB has no data.
    Returns group dict in the same format as groups_storage, or None if not found.
    """
    # Try MongoDB first
    if _init_mongo_connection() and _mongo_db is not None:
        try:
            groups_collection = _mongo_db.groups
            # Try to find by id field first, then by _id
            doc = await groups_collection.find_one({"id": group_id})
            if doc is None:
                # Try _id if it's an ObjectId string
                try:
                    doc = await groups_collection.find_one({"_id": ObjectId(group_id)})
                except Exception:
                    pass
            
            if doc:
                print(f"MongoDB: Found group {group_id}")
                group_dict = _convert_mongo_doc_to_dict(doc)
                # Ensure 'id' field exists
                if "_id" in group_dict and "id" not in group_dict:
                    group_dict["id"] = str(group_dict.pop("_id"))
                return group_dict
            else:
                print(f"MongoDB: Group {group_id} not found, falling back to in-memory")
        except Exception as e:
            print(f"MongoDB: Error reading group {group_id}: {e}, falling back to in-memory")
    
    # Fallback to in-memory storage
    return groups_storage.get(group_id)


async def get_group_expenses(group_id: str) -> List[dict]:
    """
    Get all expenses for a group (READ ONLY)
    
    Tries MongoDB first, falls back to in-memory storage if MongoDB has no data.
    Returns list of expense dicts in the same format as expenses_storage.
    """
    # Try MongoDB first
    if _init_mongo_connection() and _mongo_db is not None:
        try:
            expenses_collection = _mongo_db.expenses
            cursor = expenses_collection.find({"group_id": group_id})
            mongo_expenses = await cursor.to_list(length=None)
            
            if mongo_expenses:
                print(f"MongoDB: Found {len(mongo_expenses)} expenses for group {group_id}")
                # Convert MongoDB documents to dicts
                result = []
                for doc in mongo_expenses:
                    expense_dict = _convert_mongo_doc_to_dict(doc)
                    # Ensure 'id' field exists
                    if "_id" in expense_dict and "id" not in expense_dict:
                        expense_dict["id"] = str(expense_dict.pop("_id"))
                    result.append(expense_dict)
                return result
            else:
                print(f"MongoDB: No expenses found for group {group_id}, falling back to in-memory")
        except Exception as e:
            print(f"MongoDB: Error reading expenses for group {group_id}: {e}, falling back to in-memory")
    
    # Fallback to in-memory storage
    group_expenses = [
        expense for expense in expenses_storage.values()
        if expense.get("group_id") == group_id
    ]
    return group_expenses


# ============================================================================
# Budgets READ HELPERS (Phase 5 - MongoDB Only, No In-Memory Fallback)
# ============================================================================

async def get_budgets_for_group(group_id: str) -> List[dict]:
    """
    Get all budgets for a group from MongoDB (READ ONLY, MongoDB-ONLY).
    Returns empty list if MongoDB is unavailable or no budgets exist.
    """
    if not group_id:
        return []
    
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        print(f"MongoDB: Connection not available, returning empty budgets list for group {group_id}")
        return []
    
    try:
        budgets_collection = _mongo_db.budgets
        cursor = budgets_collection.find({"group_id": group_id})
        mongo_budgets = await cursor.to_list(length=None)
        
        if mongo_budgets:
            print(f"MongoDB: Found {len(mongo_budgets)} budgets for group {group_id}")
            result: List[dict] = []
            for doc in mongo_budgets:
                budget_dict = _convert_mongo_doc_to_dict(doc)
                # Ensure 'id' field exists
                if "_id" in budget_dict and "id" not in budget_dict:
                    budget_dict["id"] = str(budget_dict.pop("_id"))
                result.append(budget_dict)
            return result
        else:
            print(f"MongoDB: No budgets found for group {group_id}")
            return []
    except Exception as e:
        print(f"MongoDB: Error reading budgets for group {group_id}: {e}")
        return []


async def get_budgets_with_spent_for_group(group_id: str) -> List[dict]:
    """
    Get all budgets for a group with calculated spent/remaining/percentage_used (READ ONLY).
    
    - Budgets come from MongoDB via `get_budgets_for_group` (MongoDB-only).
    - Expenses come from MongoDB via `get_group_expenses` (Mongo-first).
    - For each budget, calculates:
      - spent: sum of expenses with matching category
      - remaining: max(limit - spent, 0)
      - percentage_used: (spent / limit) * 100
    
    Returns list of enriched budget dicts ready for frontend consumption.
    """
    if not group_id:
        return []
    
    # Get budgets from MongoDB (MongoDB-only, no fallback)
    budgets = await get_budgets_for_group(group_id)
    
    # Get expenses from MongoDB (Mongo-first with fallback)
    expenses = await get_group_expenses(group_id)
    
    # Precompute spending per category from expenses
    spend_by_category: Dict[str, float] = {}
    for expense in expenses:
        category = expense.get("category")
        amount = float(expense.get("amount", 0) or 0)
        if not category:
            continue
        spend_by_category[category] = spend_by_category.get(category, 0.0) + amount
    
    # Enrich each budget with spent/remaining/percentage_used
    annotated_budgets: List[dict] = []
    for budget in budgets:
        category = budget.get("category")
        limit_value = float(budget.get("limit", 0) or 0)
        spent_value = float(spend_by_category.get(category, 0.0))
        remaining_value = max(limit_value - spent_value, 0.0)
        
        # Copy budget dict and add calculated fields
        enriched = dict(budget)
        enriched["spent"] = round(spent_value, 2)
        enriched["remaining"] = round(remaining_value, 2)
        
        # Calculate percentage used (0-100)
        if limit_value > 0:
            enriched["percentage_used"] = round((spent_value / limit_value) * 100.0, 2)
        else:
            enriched["percentage_used"] = 0.0
        
        annotated_budgets.append(enriched)
    
    return annotated_budgets


# ============================================================================
# MongoDB MEMBERS & GROUP MANAGEMENT OPERATIONS (Phase 6)
# ============================================================================

async def get_group_members(group_id: str) -> List[dict]:
    """
    Get all members for a group from MongoDB (READ ONLY, MongoDB-ONLY).
    Reads from group_members collection and fetches real emails from users collection.
    Returns list of member dicts with user_id, name, email.
    """
    if not group_id:
        return []
    
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        print(f"MongoDB: Connection not available, returning empty members list for group {group_id}")
        return []
    
    try:
        group_members_collection = _mongo_db.group_members
        users_collection = _mongo_db.users
        cursor = group_members_collection.find({"group_id": group_id})
        mongo_members = await cursor.to_list(length=None)
        
        if mongo_members:
            print(f"MongoDB: Found {len(mongo_members)} members for group {group_id}")
            result: List[dict] = []
            for doc in mongo_members:
                member_dict = _convert_mongo_doc_to_dict(doc)
                user_id = member_dict.get("user_id")
                
                # Fetch real email from users collection
                user_doc = await users_collection.find_one({"id": user_id})
                real_email = None
                if user_doc:
                    real_email = user_doc.get("email")
                
                # Use real email or None (frontend will handle display)
                result.append({
                    "user_id": user_id,
                    "name": member_dict.get("name"),
                    "email": real_email  # None if not found
                })
            return result
        else:
            print(f"MongoDB: No members found for group {group_id}")
            return []
    except Exception as e:
        print(f"MongoDB: Error reading members for group {group_id}: {e}")
        return []


async def find_group_by_invite_code(invite_code: str) -> Optional[dict]:
    """
    Find a group by invite code from MongoDB (READ ONLY).
    Returns group dict or None if not found.
    """
    if not invite_code:
        return None
    
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        print(f"MongoDB: Connection not available, cannot find group by invite code")
        return None
    
    try:
        groups_collection = _mongo_db.groups
        doc = await groups_collection.find_one({"invite_code": invite_code.upper()})
        
        if doc:
            print(f"MongoDB: Found group with invite code {invite_code}")
            group_dict = _convert_mongo_doc_to_dict(doc)
            # Ensure 'id' field exists
            if "_id" in group_dict and "id" not in group_dict:
                group_dict["id"] = str(group_dict.pop("_id"))
            return group_dict
        else:
            print(f"MongoDB: No group found with invite code {invite_code}")
            return None
    except Exception as e:
        print(f"MongoDB: Error finding group by invite code {invite_code}: {e}")
        return None


async def update_group_name(group_id: str, new_name: str) -> dict:
    """
    Update group name in MongoDB (EXPLICIT, AWAITED).
    Fails loudly if MongoDB write fails.
    Returns updated group dict.
    """
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        raise RuntimeError("MongoDB connection not available - cannot update group name")
    
    if not group_id or not new_name:
        raise ValueError("Group ID and new name are required")
    
    groups_collection = _mongo_db.groups
    
    # Update group name
    result = await groups_collection.update_one(
        {"id": group_id},
        {"$set": {"name": new_name}}
    )
    
    if result.matched_count == 0:
        raise ValueError(f"Group with ID '{group_id}' not found")
    
    print(f"MongoDB: Updated group {group_id} name to '{new_name}'")
    
    # Return updated group
    doc = await groups_collection.find_one({"id": group_id})
    if doc:
        group_dict = _convert_mongo_doc_to_dict(doc)
        if "_id" in group_dict and "id" not in group_dict:
            group_dict["id"] = str(group_dict.pop("_id"))
        return group_dict
    else:
        raise RuntimeError(f"Failed to retrieve updated group {group_id}")


async def delete_group_and_related_data(group_id: str) -> None:
    """
    Delete a group and all related data from MongoDB (EXPLICIT, AWAITED).
    Hard delete - removes:
    - groups collection entry
    - group_members collection entries
    - expenses collection entries
    - budgets collection entries
    
    Fails loudly if MongoDB write fails.
    """
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        raise RuntimeError("MongoDB connection not available - cannot delete group")
    
    if not group_id:
        raise ValueError("Group ID is required")
    
    groups_collection = _mongo_db.groups
    group_members_collection = _mongo_db.group_members
    expenses_collection = _mongo_db.expenses
    budgets_collection = _mongo_db.budgets
    
    # Delete group members
    members_result = await group_members_collection.delete_many({"group_id": group_id})
    print(f"MongoDB: Deleted {members_result.deleted_count} members for group {group_id}")
    
    # Delete expenses
    expenses_result = await expenses_collection.delete_many({"group_id": group_id})
    print(f"MongoDB: Deleted {expenses_result.deleted_count} expenses for group {group_id}")
    
    # Delete budgets
    budgets_result = await budgets_collection.delete_many({"group_id": group_id})
    print(f"MongoDB: Deleted {budgets_result.deleted_count} budgets for group {group_id}")
    
    # Delete group
    group_result = await groups_collection.delete_one({"id": group_id})
    if group_result.deleted_count == 0:
        raise ValueError(f"Group with ID '{group_id}' not found")
    
    print(f"MongoDB: Deleted group {group_id} and all related data")


# ============================================================================
# MongoDB USER OPERATIONS (Phase 7 - Authentication)
# ============================================================================

def generate_user_id() -> str:
    """Generate a unique user ID"""
    return f"user_{random.randint(100000, 999999)}"


async def create_or_get_user(email: str, name: str, provider: str = "google") -> dict:
    """
    Create or get user by email (MongoDB-ONLY).
    If user exists with same email, return existing user.
    Otherwise, create new user.
    Returns user dict with id, email, name, provider, created_at.
    """
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        raise RuntimeError("MongoDB connection not available - cannot create/get user")
    
    if not email:
        raise ValueError("Email is required")
    
    users_collection = _mongo_db.users
    
    # Check if user already exists
    existing_user = await users_collection.find_one({"email": email})
    
    if existing_user:
        print(f"MongoDB: Found existing user with email {email}")
        user_dict = _convert_mongo_doc_to_dict(existing_user)
        if "_id" in user_dict and "id" not in user_dict:
            user_dict["id"] = str(user_dict.pop("_id"))
        return user_dict
    
    # Create new user
    user_id = generate_user_id()
    user_doc = {
        "id": user_id,
        "email": email,
        "name": name,
        "provider": provider,
        "created_at": datetime.now()
    }
    
    await users_collection.insert_one(user_doc)
    print(f"MongoDB: Created new user {user_id} with email {email}")
    
    return user_doc


async def get_user_by_id(user_id: str) -> Optional[dict]:
    """
    Get user by ID from MongoDB (READ ONLY, MongoDB-ONLY).
    Returns user dict or None if not found.
    """
    if not user_id:
        return None
    
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        print(f"MongoDB: Connection not available, cannot get user {user_id}")
        return None
    
    try:
        users_collection = _mongo_db.users
        doc = await users_collection.find_one({"id": user_id})
        
        if doc:
            user_dict = _convert_mongo_doc_to_dict(doc)
            if "_id" in user_dict and "id" not in user_dict:
                user_dict["id"] = str(user_dict.pop("_id"))
            return user_dict
        else:
            return None
    except Exception as e:
        print(f"MongoDB: Error getting user {user_id}: {e}")
        return None


async def get_user_by_email(email: str) -> Optional[dict]:
    """
    Get user by email from MongoDB (READ ONLY, MongoDB-ONLY).
    Returns user dict or None if not found.
    """
    if not email:
        return None
    
    # Ensure MongoDB connection is initialized and database is available
    if not _init_mongo_connection() or _mongo_db is None:
        print(f"MongoDB: Connection not available, cannot get user by email {email}")
        return None
    
    try:
        users_collection = _mongo_db.users
        doc = await users_collection.find_one({"email": email})
        
        if doc:
            user_dict = _convert_mongo_doc_to_dict(doc)
            if "_id" in user_dict and "id" not in user_dict:
                user_dict["id"] = str(user_dict.pop("_id"))
            return user_dict
        else:
            return None
    except Exception as e:
        print(f"MongoDB: Error getting user by email {email}: {e}")
        return None


# ============================================================================
# EXPENSE SPLIT & BALANCE COMPUTATION HELPERS
# ============================================================================

def _quantize_decimal(value: Decimal) -> Decimal:
    """Quantize a Decimal to 2 decimal places using ROUND_HALF_UP."""
    return value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def normalize_expense_split(
    amount: float,
    paid_by: str,
    group_members: List[dict],
    split_input: Optional[dict] = None
) -> Tuple[str, List[dict], Optional[dict]]:
    """
    Normalize expense split into a deterministic list of participant shares.
    
    Args:
        amount: Total expense amount
        paid_by: User ID of the payer
        group_members: List of group member dicts with 'user_id' key
        split_input: Optional split configuration:
            - None or {"type": "equal"}: Equal split among all members (default)
            - {"type": "equal", "participants": [user_ids]}: Equal split among subset
            - {"type": "exact", "participants": [{"user_id": str, "amount": float}]}
            - {"type": "percentage", "participants": [{"user_id": str, "percent": float}]}
    
    Returns:
        Tuple of (split_type, split_participants, raw_split_input)
        - split_type: "equal", "exact", or "percentage"
        - split_participants: [{"user_id": str, "share": Decimal}] (always sums to amount)
        - raw_split_input: Original split_input for reference
    
    Raises:
        ValueError: If split configuration is invalid
    """
    amount_decimal = Decimal(str(amount))
    
    # Default: equal split among all members
    if split_input is None or split_input.get("type") == "equal":
        split_type = "equal"
        
        # Get participants (default to all members if not specified)
        if split_input and "participants" in split_input:
            participant_ids = split_input["participants"]
            if not isinstance(participant_ids, list) or len(participant_ids) == 0:
                raise ValueError("participants must be a non-empty list")
        else:
            participant_ids = [m["user_id"] for m in group_members]
        
        # Validate all participants are group members
        member_ids = {m["user_id"] for m in group_members}
        for pid in participant_ids:
            if pid not in member_ids:
                raise ValueError(f"Participant {pid} is not a group member")
        
        # Calculate equal shares
        num_participants = len(participant_ids)
        share_each = amount_decimal / Decimal(num_participants)
        share_each_quantized = _quantize_decimal(share_each)
        
        # Build participants list
        split_participants = [
            {"user_id": pid, "share": share_each_quantized}
            for pid in participant_ids
        ]
        
        # Reconcile rounding residue to payer
        total_shares = sum(p["share"] for p in split_participants)
        residue = amount_decimal - total_shares
        if residue != Decimal('0'):
            # Find payer in participants or first participant
            payer_index = next(
                (i for i, p in enumerate(split_participants) if p["user_id"] == paid_by),
                0
            )
            split_participants[payer_index]["share"] += residue
            split_participants[payer_index]["share"] = _quantize_decimal(
                split_participants[payer_index]["share"]
            )
        
        return (split_type, split_participants, split_input)
    
    # Exact amounts
    elif split_input.get("type") == "exact":
        split_type = "exact"
        participants_input = split_input.get("participants", [])
        
        if not isinstance(participants_input, list) or len(participants_input) == 0:
            raise ValueError("exact split requires non-empty participants list")
        
        # Validate all participants are group members and extract amounts
        member_ids = {m["user_id"] for m in group_members}
        split_participants = []
        total_specified = Decimal('0')
        
        for p in participants_input:
            user_id = p.get("user_id")
            share_amount = p.get("amount")
            
            if not user_id or share_amount is None:
                raise ValueError("exact split participant must have user_id and amount")
            
            if user_id not in member_ids:
                raise ValueError(f"Participant {user_id} is not a group member")
            
            share_decimal = _quantize_decimal(Decimal(str(share_amount)))
            split_participants.append({"user_id": user_id, "share": share_decimal})
            total_specified += share_decimal
        
        # Check if total matches amount (tolerate ±0.01)
        diff = abs(total_specified - amount_decimal)
        if diff > Decimal('0.01'):
            raise ValueError(
                f"exact split amounts ({total_specified}) must sum to total amount ({amount_decimal}), "
                f"difference: {diff}"
            )
        
        # Reconcile any small difference to payer
        residue = amount_decimal - total_specified
        if residue != Decimal('0'):
            payer_index = next(
                (i for i, p in enumerate(split_participants) if p["user_id"] == paid_by),
                0
            )
            split_participants[payer_index]["share"] += residue
            split_participants[payer_index]["share"] = _quantize_decimal(
                split_participants[payer_index]["share"]
            )
        
        return (split_type, split_participants, split_input)
    
    # Percentage
    elif split_input.get("type") == "percentage":
        split_type = "percentage"
        participants_input = split_input.get("participants", [])
        
        if not isinstance(participants_input, list) or len(participants_input) == 0:
            raise ValueError("percentage split requires non-empty participants list")
        
        # Validate all participants are group members and extract percentages
        member_ids = {m["user_id"] for m in group_members}
        split_participants = []
        total_percent = Decimal('0')
        
        for p in participants_input:
            user_id = p.get("user_id")
            percent = p.get("percent")
            
            if not user_id or percent is None:
                raise ValueError("percentage split participant must have user_id and percent")
            
            if user_id not in member_ids:
                raise ValueError(f"Participant {user_id} is not a group member")
            
            percent_decimal = Decimal(str(percent))
            total_percent += percent_decimal
            
            # Calculate share from percentage
            share = (amount_decimal * percent_decimal) / Decimal('100')
            share_quantized = _quantize_decimal(share)
            split_participants.append({"user_id": user_id, "share": share_quantized})
        
        # Check if percentages sum to 100 (tolerate small differences)
        if abs(total_percent - Decimal('100')) > Decimal('0.01'):
            raise ValueError(
                f"percentage split percentages must sum to 100, got {total_percent}"
            )
        
        # Reconcile rounding residue to payer
        total_shares = sum(p["share"] for p in split_participants)
        residue = amount_decimal - total_shares
        if residue != Decimal('0'):
            payer_index = next(
                (i for i, p in enumerate(split_participants) if p["user_id"] == paid_by),
                0
            )
            split_participants[payer_index]["share"] += residue
            split_participants[payer_index]["share"] = _quantize_decimal(
                split_participants[payer_index]["share"]
            )
        
        return (split_type, split_participants, split_input)
    
    else:
        raise ValueError(f"Invalid split type: {split_input.get('type')}")


async def compute_group_balances(group_id: str) -> Dict[str, Decimal]:
    """
    Compute balances for all members in a group.
    
    CRITICAL: final_balances = expense_balances - settlement_balances
    
    Balance logic:
    1. Compute expense balances:
       - For each expense:
         - Payer's balance increases by full amount paid
         - Each participant's balance decreases by their share
    
    2. Compute settlement balances:
       - For each settlement:
         - Debtor (from) balance increases (moves toward zero)
         - Creditor (to) balance decreases (moves toward zero)
    
    3. Final balance = expense_balance - settlement_balance
    
    Positive balance = person is owed money
    Negative balance = person owes money
    
    Args:
        group_id: The group ID
    
    Returns:
        Dict mapping user_id to Decimal balance (quantized to 2 decimal places)
    """
    # Get group members
    group = await get_group_by_id(group_id)
    if not group:
        return {}
    
    members = group.get("members", [])
    
    # Initialize balances to zero for all members
    balances: Dict[str, Decimal] = {
        member["user_id"]: Decimal('0.00')
        for member in members
    }
    
    # STEP 1: Compute expense balances
    expenses = await get_group_expenses(group_id)
    
    for expense in expenses:
        paid_by = expense.get("paid_by")
        amount = Decimal(str(expense.get("amount", 0)))
        
        # Payer's balance increases by the full amount
        if paid_by in balances:
            balances[paid_by] += amount
        else:
            # Payer might not be a current member (if they left), but we track anyway
            balances[paid_by] = amount
        
        # Get split participants from expense doc
        split_participants = expense.get("split_participants", [])
        
        # If no split_participants stored (old format), fall back to splits
        if not split_participants:
            splits = expense.get("splits", [])
            for split in splits:
                user_id = split.get("user_id")
                amount_owed = Decimal(str(split.get("amount_owed", 0)))
                if user_id in balances:
                    balances[user_id] -= amount_owed
                else:
                    balances[user_id] = -amount_owed
        else:
            # Use normalized split_participants
            for participant in split_participants:
                user_id = participant.get("user_id")
                share = Decimal(str(participant.get("share", 0)))
                if user_id in balances:
                    balances[user_id] -= share
                else:
                    balances[user_id] = -share
    
    # Debug log: Expense contribution
    expense_balances = {k: v for k, v in balances.items()}
    print(f"EXPENSE CONTRIBUTION: {expense_balances}")
    
    # STEP 2: Subtract settlement balances
    # Settlements resolve debt - they move balances toward zero
    settlements = await get_group_settlements(group_id)
    
    # Calculate settlement effects before applying
    settlement_effects: Dict[str, Decimal] = {user_id: Decimal('0') for user_id in balances.keys()}
    
    for settlement in settlements:
        from_user = settlement.get("from")  # Debtor (person who owed)
        to_user = settlement.get("to")      # Creditor (person who was owed)
        amount = Decimal(str(settlement.get("amount", 0)))
        
        # Track settlement effects
        if from_user not in settlement_effects:
            settlement_effects[from_user] = Decimal('0')
        if to_user not in settlement_effects:
            settlement_effects[to_user] = Decimal('0')
        
        settlement_effects[from_user] += amount
        settlement_effects[to_user] -= amount
        
        # Debtor's balance increases (becomes less negative, moves toward zero)
        if from_user in balances:
            balances[from_user] += amount
        else:
            balances[from_user] = amount
        
        # Creditor's balance decreases (becomes less positive, moves toward zero)
        if to_user in balances:
            balances[to_user] -= amount
        else:
            balances[to_user] = -amount
    
    # Debug log: Settlement contribution
    print(f"SETTLEMENT CONTRIBUTION: {settlement_effects}")
    
    # Quantize all balances
    for user_id in balances:
        balances[user_id] = _quantize_decimal(balances[user_id])
    
    # Debug log: Final balances
    print(f"FINAL BALANCES: {balances}")
    
    return balances


def compute_settlements_from_balances(balances: Dict[str, Decimal]) -> List[dict]:
    """
    Compute settlement transactions from balances using greedy algorithm.
    
    Algorithm:
    1. Separate balances into creditors (positive) and debtors (negative)
    2. Sort creditors descending, debtors by absolute value descending
    3. Greedily match largest debtor to largest creditor
    4. Create transaction for min(debt, credit)
    5. Repeat until all settled
    
    Args:
        balances: Dict mapping user_id to Decimal balance
    
    Returns:
        List of settlement transactions: [{"from": user_id, "to": user_id, "amount": Decimal}]
    """
    # Separate creditors and debtors
    creditors = [(user_id, balance) for user_id, balance in balances.items() if balance > Decimal('0')]
    debtors = [(user_id, abs(balance)) for user_id, balance in balances.items() if balance < Decimal('0')]
    
    # Sort by amount descending
    creditors.sort(key=lambda x: x[1], reverse=True)
    debtors.sort(key=lambda x: x[1], reverse=True)
    
    settlements = []
    creditor_idx = 0
    debtor_idx = 0
    
    while creditor_idx < len(creditors) and debtor_idx < len(debtors):
        creditor_id, credit_remaining = creditors[creditor_idx]
        debtor_id, debt_remaining = debtors[debtor_idx]
        
        # Settle min of debt and credit
        settlement_amount = min(debt_remaining, credit_remaining)
        settlement_amount = _quantize_decimal(settlement_amount)
        
        if settlement_amount > Decimal('0'):
            settlements.append({
                "from": debtor_id,
                "to": creditor_id,
                "amount": settlement_amount
            })
        
        # Update remaining amounts
        creditors[creditor_idx] = (creditor_id, credit_remaining - settlement_amount)
        debtors[debtor_idx] = (debtor_id, debt_remaining - settlement_amount)
        
        # Move to next if settled
        if creditors[creditor_idx][1] <= Decimal('0.001'):  # Tolerance for rounding
            creditor_idx += 1
        if debtors[debtor_idx][1] <= Decimal('0.001'):
            debtor_idx += 1
    
    return settlements


# ============================================================================
# EXPENSE DELETE/UPDATE OPERATIONS
# ============================================================================

async def delete_expense_from_mongo(expense_id: str) -> None:
    """
    Delete an expense from MongoDB (EXPLICIT, AWAITED).
    Fails loudly if MongoDB write fails.
    """
    if not _init_mongo_connection() or _mongo_db is None:
        raise RuntimeError("MongoDB connection not available - cannot delete expense")
    
    if not expense_id:
        raise ValueError("Expense ID is required")
    
    expenses_collection = _mongo_db.expenses
    result = await expenses_collection.delete_one({"id": expense_id})
    
    if result.deleted_count > 0:
        print(f"MongoDB: Delete expense OK: {expense_id}")
    else:
        print(f"MongoDB: Expense {expense_id} not found for deletion")


async def update_expense_in_mongo(expense_id: str, updates: dict) -> None:
    """
    Update an expense in MongoDB (EXPLICIT, AWAITED).
    Fails loudly if MongoDB write fails.
    """
    if not _init_mongo_connection() or _mongo_db is None:
        raise RuntimeError("MongoDB connection not available - cannot update expense")
    
    if not expense_id:
        raise ValueError("Expense ID is required")
    
    expenses_collection = _mongo_db.expenses
    result = await expenses_collection.update_one(
        {"id": expense_id},
        {"$set": updates}
    )
    
    if result.matched_count > 0:
        print(f"MongoDB: Update expense OK: {expense_id}")
    else:
        raise ValueError(f"Expense {expense_id} not found for update")


# ============================================================================
# SETTLEMENT OPERATIONS (Settlements are NOT expenses)
# ============================================================================

async def create_settlement_in_mongo(settlement: dict) -> None:
    """
    Create a settlement in MongoDB (EXPLICIT, AWAITED).
    
    Settlements are NOT expenses. They resolve debt created by expenses.
    They do NOT affect total spent or budgets.
    
    Args:
        settlement: Dict with keys: id, group_id, from (debtor), to (creditor), amount, created_at
    
    Fails loudly if MongoDB write fails.
    """
    if not _init_mongo_connection() or _mongo_db is None:
        raise RuntimeError("MongoDB connection not available - cannot create settlement")
    
    if not settlement:
        raise ValueError("Settlement data is required")
    
    settlement_id = settlement.get("id")
    if not settlement_id:
        raise ValueError("Settlement ID is required")
    
    # Validate required fields
    if not settlement.get("group_id"):
        raise ValueError("Settlement group_id is required")
    if not settlement.get("from"):
        raise ValueError("Settlement 'from' (debtor) is required")
    if not settlement.get("to"):
        raise ValueError("Settlement 'to' (creditor) is required")
    
    amount = settlement.get("amount")
    if not amount or amount <= 0:
        raise ValueError("Settlement amount must be > 0")
    
    settlements_collection = _mongo_db.settlements
    settlement_doc = dict(settlement)
    
    # Ensure created_at timestamp
    if "created_at" not in settlement_doc:
        settlement_doc["created_at"] = datetime.now()
    
    # Insert settlement
    await settlements_collection.insert_one(settlement_doc)
    print(f"MongoDB: Insert settlement OK: {settlement_id} for group {settlement_doc.get('group_id')}")


async def get_group_settlements(group_id: str) -> List[dict]:
    """
    Get all settlements for a group (READ ONLY).
    
    Settlements are separate from expenses and represent money already paid
    to settle debts.
    
    Args:
        group_id: The group ID
    
    Returns:
        List of settlement dicts
    """
    if not group_id:
        return []
    
    # Try MongoDB
    if _init_mongo_connection() and _mongo_db is not None:
        try:
            settlements_collection = _mongo_db.settlements
            cursor = settlements_collection.find({"group_id": group_id})
            mongo_settlements = await cursor.to_list(length=None)
            
            if mongo_settlements:
                print(f"MongoDB: Found {len(mongo_settlements)} settlements for group {group_id}")
                result = []
                for doc in mongo_settlements:
                    settlement_dict = _convert_mongo_doc_to_dict(doc)
                    if "_id" in settlement_dict and "id" not in settlement_dict:
                        settlement_dict["id"] = str(settlement_dict.pop("_id"))
                    result.append(settlement_dict)
                return result
            else:
                print(f"MongoDB: No settlements found for group {group_id}")
                return []
        except Exception as e:
            print(f"MongoDB: Error reading settlements for group {group_id}: {e}")
            return []
    
    return []
