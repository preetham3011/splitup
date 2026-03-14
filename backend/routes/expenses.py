"""
Expense management routes

Handles creating expenses and listing expenses for a group.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List

from models.expense import ExpenseCreate, ExpenseResponse, ExpenseSplit
from routes.auth import get_current_user_optional
from data.storage import (
    groups_storage,
    expenses_storage,
    generate_expense_id,
    get_user_name,
    get_group_by_id,
    get_group_expenses,
    create_expense_in_mongo,
    normalize_expense_split,
    compute_group_balances,
    delete_expense_from_mongo,
    update_expense_in_mongo,
)
from datetime import datetime

router = APIRouter(prefix="/groups/{group_id}/expenses")


async def _validate_group_membership(group_id: str, current_user: dict):
    """
    Helper function to validate that current user is a member of the group.
    Raises HTTPException if group doesn't exist or user is not a member.
    Returns the group if valid.
    """
    # Get group from MongoDB (with fallback to in-memory)
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
    
    return group


def _validate_paid_by_user(group: dict, paid_by_user_id: str):
    """
    Helper function to validate that the 'paid_by' user is a member of the group.
    Raises HTTPException if user is not a member.
    """
    is_member = any(
        member.get("user_id") == paid_by_user_id 
        for member in group.get("members", [])
    )
    
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User '{paid_by_user_id}' is not a member of this group"
        )


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(group_id: str, expense_data: ExpenseCreate, current_user: dict = Depends(get_current_user_optional)):
    """
    Create a new expense in a group
    
    - **title**: Description of the expense
    - **amount**: Total amount of the expense (must be > 0)
    - **paid_by**: User ID of person who paid
    - **category**: Expense category (default: "Other")
    - **split_type**: How to split (only "equal" supported in Phase 2)
    - **date**: Date of expense (defaults to now)
    
    The expense is split equally among all group members.
    Returns the created expense with split details.
    """
    # Validate group exists and user is a member
    group = await _validate_group_membership(group_id, current_user)
    
    # Validate that paid_by user is a member of the group
    _validate_paid_by_user(group, expense_data.paid_by)
    
    # Generate unique expense ID
    expense_id = generate_expense_id()
    
    # Normalize expense split using new helper
    try:
        split_type, split_participants, raw_split_input = normalize_expense_split(
            amount=expense_data.amount,
            paid_by=expense_data.paid_by,
            group_members=group.get("members", []),
            split_input=expense_data.split
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid split configuration: {str(e)}"
        )
    
    # Convert split_participants to legacy splits format for backward compatibility
    splits = [
        {
            "user_id": p["user_id"],
            "amount_owed": float(p["share"])
        }
        for p in split_participants
    ]
    
    # Create expense record with normalized split_participants
    # Note: paid_by_name is NOT stored - it's resolved at read time
    expense = {
        "id": expense_id,
        "group_id": group_id,
        "title": expense_data.title,
        "amount": expense_data.amount,
        "paid_by": expense_data.paid_by,
        "category": expense_data.category,
        "split_type": split_type,
        "date": expense_data.date,
        "created_at": datetime.now(),
        "created_by": current_user["id"],
        "splits": splits,
        "split_participants": [
            {"user_id": p["user_id"], "share": float(p["share"])}
            for p in split_participants
        ],
        "raw_split_input": raw_split_input
    }
    
    # Write to MongoDB first (explicit, awaited - fails loudly if it fails)
    await create_expense_in_mongo(expense)
    
    # Store expense in memory after MongoDB succeeds
    expenses_storage[expense_id] = expense
    
    # Resolve paid_by_name at read time (not stored in DB)
    paid_by_name = await get_user_name(expense_data.paid_by)
    
    # Build response
    return ExpenseResponse(
        id=expense["id"],
        group_id=expense["group_id"],
        title=expense["title"],
        amount=expense["amount"],
        paid_by=expense["paid_by"],
        paid_by_name=paid_by_name,
        category=expense["category"],
        split_type=expense["split_type"],
        date=expense["date"],
        created_at=expense["created_at"],
        created_by=expense["created_by"],
        splits=[ExpenseSplit(**split) for split in expense["splits"]]
    )


@router.get("", response_model=List[ExpenseResponse])
async def list_expenses(group_id: str, current_user: dict = Depends(get_current_user_optional)):
    """
    List all expenses for a group
    
    Returns a list of all expenses in the group.
    Only accessible to group members.
    """
    # Validate group exists and user is a member
    await _validate_group_membership(group_id, current_user)
    
    # Get expenses from MongoDB (with fallback to in-memory)
    group_expenses = await get_group_expenses(group_id)
    
    # Sort by date (most recent first)
    group_expenses.sort(key=lambda x: x.get("date", datetime.min), reverse=True)
    
    # Build response list with name enrichment at read time
    response_list = []
    for expense in group_expenses:
        # Resolve paid_by_name at read time (not stored in DB)
        paid_by_name = await get_user_name(expense["paid_by"])
        
        response_list.append(
            ExpenseResponse(
                id=expense["id"],
                group_id=expense["group_id"],
                title=expense["title"],
                amount=expense["amount"],
                paid_by=expense["paid_by"],
                paid_by_name=paid_by_name,
                category=expense["category"],
                split_type=expense["split_type"],
                date=expense["date"],
                created_at=expense["created_at"],
                created_by=expense["created_by"],
                splits=[ExpenseSplit(**split) for split in expense.get("splits", [])]
            )
        )
    
    return response_list


@router.delete("/{expense_id}")
async def delete_expense(group_id: str, expense_id: str, current_user: dict = Depends(get_current_user_optional)):
    """
    Delete an expense and return updated balances
    
    Removes the expense from the database and recomputes group balances.
    Returns the updated balance information for all group members.
    """
    # Validate group exists and user is a member
    await _validate_group_membership(group_id, current_user)
    
    # Check if expense exists
    group_expenses = await get_group_expenses(group_id)
    expense_to_delete = next((e for e in group_expenses if e.get("id") == expense_id), None)
    
    if not expense_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with ID '{expense_id}' not found in group '{group_id}'"
        )
    
    # Delete from MongoDB
    await delete_expense_from_mongo(expense_id)
    
    # Remove from in-memory storage
    if expense_id in expenses_storage:
        del expenses_storage[expense_id]
    
    # Compute updated balances
    balances = await compute_group_balances(group_id)
    
    return {
        "success": True,
        "expense_id": expense_id,
        "balances": {user_id: float(balance) for user_id, balance in balances.items()}
    }
