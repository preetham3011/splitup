"""
Activity feed routes

Provides read-only aggregation of expenses and settlements for activity feed.
"""

from fastapi import APIRouter, Depends
from typing import List, Dict
from datetime import datetime

from data.storage import (
    get_groups_for_user,
    get_group_expenses,
    get_group_settlements,
    get_user_name,
)
from routes.auth import get_current_user_optional

router = APIRouter(prefix="/activity")


@router.get("")
async def get_activity_feed(current_user: dict = Depends(get_current_user_optional)):
    """
    Get activity feed for the current user across all their groups.
    
    Returns a chronologically sorted list of activities including:
    - Expenses added
    - Settlements recorded
    
    This is a read-only endpoint - pure aggregation of existing data.
    """
    user_id = current_user["id"]
    
    # Get all groups the user is a member of
    groups = await get_groups_for_user(user_id)
    
    activities: List[Dict] = []
    
    # Aggregate expenses and settlements from all groups
    for group in groups:
        group_id = group.get("id")
        group_name = group.get("name", "Unknown Group")
        
        # Get expenses for this group
        expenses = await get_group_expenses(group_id)
        for expense in expenses:
            paid_by = expense.get("paid_by")
            paid_by_name = await get_user_name(paid_by)
            amount = expense.get("amount", 0)
            description = expense.get("description", "Expense")
            created_at = expense.get("created_at")
            
            # Format message based on whether current user paid
            if paid_by == user_id:
                message = f"You added ₹{amount} {description} in {group_name}"
            else:
                message = f"{paid_by_name} added ₹{amount} {description} in {group_name}"
            
            activities.append({
                "type": "expense",
                "message": message,
                "amount": amount,
                "group_id": group_id,
                "group_name": group_name,
                "created_at": created_at or datetime.now().isoformat(),
            })
        
        # Get settlements for this group
        settlements = await get_group_settlements(group_id)
        for settlement in settlements:
            from_user = settlement.get("from")
            to_user = settlement.get("to")
            amount = settlement.get("amount", 0)
            created_at = settlement.get("created_at")
            
            # Resolve names
            from_name = await get_user_name(from_user)
            to_name = await get_user_name(to_user)
            
            # Format message based on current user's involvement
            if from_user == user_id:
                message = f"You settled ₹{amount} with {to_name} in {group_name}"
            elif to_user == user_id:
                message = f"{from_name} settled ₹{amount} with you in {group_name}"
            else:
                message = f"{from_name} settled ₹{amount} with {to_name} in {group_name}"
            
            activities.append({
                "type": "settlement",
                "message": message,
                "amount": amount,
                "group_id": group_id,
                "group_name": group_name,
                "created_at": created_at or datetime.now().isoformat(),
            })
    
    # Sort by created_at descending (most recent first)
    activities.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    # Limit to last 20 activities
    activities = activities[:20]
    
    return {
        "activities": activities,
        "total": len(activities)
    }
