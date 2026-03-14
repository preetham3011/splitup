"""
Group management routes

Handles creating groups, joining groups, listing groups, and getting group details.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from pydantic import BaseModel, Field

from models.group import GroupCreate, GroupResponse, GroupJoin, GroupMember
from routes.auth import get_current_user_optional
from data.storage import (
    groups_storage,
    generate_group_id,
    generate_invite_code,
    get_user_name,
    add_user,
    get_groups_for_user,
    get_group_by_id,
    create_group_in_mongo,
    add_member_to_group_in_mongo,
    get_group_members,
    find_group_by_invite_code,
    update_group_name,
    delete_group_and_related_data,
)
from datetime import datetime

router = APIRouter(prefix="/groups")


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(group_data: GroupCreate, current_user: dict = Depends(get_current_user_optional)):
    """
    Create a new group
    
    - **name**: Name of the group
    - **type**: Type of group (home, trip, couple, other)
    - **currency**: Currency code (default: INR)
    - **simplify_debts**: Whether to simplify debts (default: True)
    
    Current user becomes the admin and first member.
    """
    # Generate unique group ID and invite code
    group_id = generate_group_id()
    invite_code = generate_invite_code()
    
    # Create the group
    group = {
        "id": group_id,
        "name": group_data.name,
        "type": group_data.type,
        "invite_code": invite_code,
        "currency": group_data.currency,
        "simplify_debts": group_data.simplify_debts,
        "created_at": datetime.now(),
        "created_by": current_user["id"],
        "members": [
            {
                "user_id": current_user["id"],
                "name": current_user["name"],
                "role": "admin",
                "joined_at": datetime.now()
            }
        ]
    }
    
    # Write to MongoDB first (explicit, awaited - fails loudly if it fails)
    await create_group_in_mongo(group)
    
    # Store group in memory after MongoDB succeeds
    groups_storage[group_id] = group
    
    # Ensure current user exists in users storage
    add_user(current_user["id"], current_user["name"])
    
    # Build response
    return GroupResponse(
        id=group["id"],
        name=group["name"],
        type=group["type"],
        invite_code=group["invite_code"],
        currency=group["currency"],
        simplify_debts=group["simplify_debts"],
        created_at=group["created_at"],
        created_by=group["created_by"],
        members=[GroupMember(**member) for member in group["members"]],
        member_count=len(group["members"])
    )


@router.post("/join", response_model=GroupResponse)
async def join_group(join_data: GroupJoin, current_user: dict = Depends(get_current_user_optional)):
    """
    Join a group using an invite code
    
    - **invite_code**: The group's invite code (e.g., "X8J2-9K")
    
    Returns the group details if successfully joined.
    Raises 404 if invite code is invalid.
    Raises 400 if user is already a member.
    """
    invite_code = join_data.invite_code.strip().upper()
    
    # Find group by invite code from MongoDB
    group = await find_group_by_invite_code(invite_code)
    
    # Fallback to in-memory storage if not found in MongoDB
    if not group:
        for g in groups_storage.values():
            if g.get("invite_code") == invite_code:
                group = g
                break
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group with invite code '{invite_code}' not found"
        )
    
    # Check if user is already a member
    existing_member = any(
        member.get("user_id") == current_user["id"] 
        for member in group.get("members", [])
    )
    
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of this group"
        )
    
    # Add current user as a member
    new_member = {
        "user_id": current_user["id"],
        "name": current_user["name"],
        "role": "member",
        "joined_at": datetime.now()
    }
    
    # Write to MongoDB first (explicit, awaited - fails loudly if it fails)
    await add_member_to_group_in_mongo(group["id"], new_member)
    
    # Update in-memory storage after MongoDB succeeds
    # Ensure members list exists
    if "members" not in group:
        group["members"] = []
    group["members"].append(new_member)
    groups_storage[group["id"]] = group
    
    # Ensure current user exists in users storage
    add_user(current_user["id"], current_user["name"])
    
    # Build response
    return GroupResponse(
        id=group["id"],
        name=group["name"],
        type=group["type"],
        invite_code=group["invite_code"],
        currency=group["currency"],
        simplify_debts=group["simplify_debts"],
        created_at=group["created_at"],
        created_by=group["created_by"],
        members=[GroupMember(**member) for member in group.get("members", [])],
        member_count=len(group.get("members", []))
    )


@router.get("", response_model=List[GroupResponse])
async def list_groups(current_user: dict = Depends(get_current_user_optional)):
    """
    List all groups where the current user is a member
    
    Returns a list of groups the user belongs to.
    """
    # Get groups from MongoDB (with fallback to in-memory)
    groups = await get_groups_for_user(current_user["id"])
    
    # Build response list
    return [
        GroupResponse(
            id=group["id"],
            name=group["name"],
            type=group["type"],
            invite_code=group["invite_code"],
            currency=group["currency"],
            simplify_debts=group["simplify_debts"],
            created_at=group["created_at"],
            created_by=group["created_by"],
            members=[GroupMember(**member) for member in group.get("members", [])],
            member_count=len(group.get("members", []))
        )
        for group in groups
    ]


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(group_id: str, current_user: dict = Depends(get_current_user_optional)):
    """
    Get group details by group ID
    
    - **group_id**: The ID of the group
    
    Returns group details if user is a member.
    Raises 404 if group doesn't exist.
    Raises 403 if user is not a member.
    """
    # Get group from MongoDB (with fallback to in-memory)
    group = await get_group_by_id(group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group with ID '{group_id}' not found"
        )
    
    # Check if current user is a member
    is_member = any(
        member.get("user_id") == current_user["id"] 
        for member in group.get("members", [])
    )
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    # Build response
    return GroupResponse(
        id=group["id"],
        name=group["name"],
        type=group["type"],
        invite_code=group["invite_code"],
        currency=group["currency"],
        simplify_debts=group["simplify_debts"],
        created_at=group["created_at"],
        created_by=group["created_by"],
        members=[GroupMember(**member) for member in group.get("members", [])],
        member_count=len(group.get("members", []))
    )


@router.get("/{group_id}/members", response_model=List[dict])
async def get_group_members_route(group_id: str, current_user: dict = Depends(get_current_user_optional)):
    """
    Get all members for a group
    
    - **group_id**: The ID of the group
    
    Returns list of members with user_id, name, email.
    Raises 404 if group doesn't exist.
    Raises 403 if user is not a member.
    """
    # Validate group exists and user is a member
    group = await get_group_by_id(group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group with ID '{group_id}' not found"
        )
    
    is_member = any(
        member.get("user_id") == current_user["id"] 
        for member in group.get("members", [])
    )
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    # Get members from MongoDB
    members = await get_group_members(group_id)
    return members


class GroupUpdate(BaseModel):
    """Request model for updating a group"""
    name: str = Field(..., min_length=1, max_length=100, description="New group name")


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(group_id: str, update_data: GroupUpdate, current_user: dict = Depends(get_current_user_optional)):
    """
    Update group name
    
    - **group_id**: The ID of the group
    - **name**: New group name
    
    Returns updated group details.
    Raises 404 if group doesn't exist.
    Raises 403 if user is not a member.
    """
    # Validate group exists and user is a member
    group = await get_group_by_id(group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group with ID '{group_id}' not found"
        )
    
    is_member = any(
        member.get("user_id") == current_user["id"] 
        for member in group.get("members", [])
    )
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    # Update group name in MongoDB
    updated_group = await update_group_name(group_id, update_data.name)
    
    # Update in-memory storage
    groups_storage[group_id] = updated_group
    
    # Build response
    return GroupResponse(
        id=updated_group["id"],
        name=updated_group["name"],
        type=updated_group["type"],
        invite_code=updated_group["invite_code"],
        currency=updated_group["currency"],
        simplify_debts=updated_group["simplify_debts"],
        created_at=updated_group["created_at"],
        created_by=updated_group["created_by"],
        members=[GroupMember(**member) for member in updated_group.get("members", [])],
        member_count=len(updated_group.get("members", []))
    )


@router.get("/{group_id}/stats")
async def get_group_stats(group_id: str, current_user: dict = Depends(get_current_user_optional)):
    """
    Get statistics for a specific group
    
    - **group_id**: The ID of the group
    
    Returns:
    - total_spent: Total amount spent in group (expenses only, excludes settlements)
    - your_balance: Current user's balance (positive = owed, negative = owes)
    - budget_used: Total amount used across all budgets
    - budget_limit: Total budget limit
    - budget_percent: Percentage of budget used
    
    Raises 404 if group doesn't exist.
    Raises 403 if user is not a member.
    """
    from data.storage import get_group_expenses, compute_group_balances, get_budgets_with_spent_for_group
    from decimal import Decimal
    
    # Validate group exists and user is a member
    group = await get_group_by_id(group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group with ID '{group_id}' not found"
        )
    
    is_member = any(
        member.get("user_id") == current_user["id"] 
        for member in group.get("members", [])
    )
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    # Calculate total spent (expenses only, exclude settlements)
    expenses = await get_group_expenses(group_id)
    total_spent = sum(float(exp.get("amount", 0)) for exp in expenses)
    
    # Get user's balance (includes settlements)
    balances = await compute_group_balances(group_id)
    user_balance = balances.get(current_user["id"], Decimal('0'))
    
    # Get budgets with spent amounts
    budgets = await get_budgets_with_spent_for_group(group_id)
    budget_used = sum(float(b.get("spent", 0)) for b in budgets)
    budget_limit = sum(float(b.get("limit", 0)) for b in budgets)
    
    # Calculate budget percentage
    if budget_limit > 0:
        budget_percent = (budget_used / budget_limit) * 100.0
    else:
        budget_percent = 0.0
    
    return {
        "total_spent": round(total_spent, 2),
        "your_balance": round(float(user_balance), 2),
        "budget_used": round(budget_used, 2),
        "budget_limit": round(budget_limit, 2),
        "budget_percent": round(budget_percent, 2)
    }


@router.delete("/{group_id}")
async def delete_group(group_id: str, current_user: dict = Depends(get_current_user_optional)):
    """
    Delete a group and all related data
    
    - **group_id**: The ID of the group
    
    Returns success response.
    Raises 404 if group doesn't exist.
    Raises 403 if user is not a member.
    """
    # Validate group exists and user is a member
    group = await get_group_by_id(group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group with ID '{group_id}' not found"
        )
    
    is_member = any(
        member.get("user_id") == current_user["id"] 
        for member in group.get("members", [])
    )
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group"
        )
    
    # Delete group and all related data from MongoDB
    await delete_group_and_related_data(group_id)
    
    # Remove from in-memory storage
    if group_id in groups_storage:
        del groups_storage[group_id]
    
    return {"success": True}
