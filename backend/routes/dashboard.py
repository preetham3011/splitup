"""
Dashboard stats routes

Provides aggregated statistics for the user's dashboard view.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from pydantic import BaseModel

from routes.auth import get_current_user_optional
from data.storage import (
    get_groups_for_user,
    get_group_expenses,
    compute_group_balances,
    get_budgets_with_spent_for_group,
)
from decimal import Decimal

router = APIRouter(prefix="/dashboard")


class DashboardStats(BaseModel):
    """Global dashboard statistics"""
    groups_count: int
    total_spent: float
    you_owe: float
    you_are_owed: float


class DashboardGroup(BaseModel):
    """Group info for dashboard with user's balance"""
    group_id: str
    name: str
    type: str
    your_balance: float
    total_spent: float
    member_count: int
    budget_percent: float


class GroupStats(BaseModel):
    """Statistics for a specific group"""
    total_spent: float
    your_balance: float
    budget_used: float
    budget_limit: float
    budget_percent: float


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user_optional)):
    """
    Get global dashboard statistics for the current user
    
    Returns:
    - groups_count: Number of groups user belongs to
    - total_spent: Total amount spent across all groups (expenses only, excludes settlements)
    - you_owe: Sum of negative balances (absolute value)
    - you_are_owed: Sum of positive balances
    
    All values are computed from backend data.
    """
    user_id = current_user["id"]
    
    # Get all groups user belongs to
    groups = await get_groups_for_user(user_id)
    groups_count = len(groups)
    
    total_spent = 0.0
    you_owe = 0.0
    you_are_owed = 0.0
    
    # Iterate through each group to compute aggregates
    for group in groups:
        group_id = group.get("id")
        
        # Get expenses for this group (exclude settlements from spending)
        expenses = await get_group_expenses(group_id)
        
        # Sum up expenses where current user paid (this is their contribution to total spent)
        for expense in expenses:
            paid_by = expense.get("paid_by")
            amount = float(expense.get("amount", 0))
            
            # Only count expenses user paid for total_spent
            if paid_by == user_id:
                total_spent += amount
        
        # Get balances for this group (includes settlements)
        balances = await compute_group_balances(group_id)
        user_balance = balances.get(user_id, Decimal('0'))
        user_balance_float = float(user_balance)
        
        # Accumulate you_owe and you_are_owed
        if user_balance_float < 0:
            you_owe += abs(user_balance_float)
        elif user_balance_float > 0:
            you_are_owed += user_balance_float
    
    return DashboardStats(
        groups_count=groups_count,
        total_spent=round(total_spent, 2),
        you_owe=round(you_owe, 2),
        you_are_owed=round(you_are_owed, 2)
    )


@router.get("/groups", response_model=List[DashboardGroup])
async def get_dashboard_groups(current_user: dict = Depends(get_current_user_optional)):
    """
    Get all groups with user's balance and spending info for dashboard cards
    
    Returns list of groups with:
    - group_id: Group ID
    - name: Group name
    - type: Group type (home, trip, couple, other)
    - your_balance: User's balance in this group (positive = owed, negative = owes)
    - total_spent: Total spent in this group (expenses only, excludes settlements)
    - member_count: Number of members
    """
    user_id = current_user["id"]
    
    # Get all groups user belongs to
    groups = await get_groups_for_user(user_id)
    
    result = []
    
    for group in groups:
        group_id = group.get("id")
        
        # Calculate total spent (expenses only, exclude settlements)
        expenses = await get_group_expenses(group_id)
        total_spent = sum(float(exp.get("amount", 0)) for exp in expenses)
        
        # Get user's balance (includes settlements)
        balances = await compute_group_balances(group_id)
        user_balance = balances.get(user_id, Decimal('0'))
        
        # Get budgets with spent amounts
        budgets = await get_budgets_with_spent_for_group(group_id)
        budget_limit = sum(float(b.get("limit", 0)) for b in budgets)
        budget_used = sum(float(b.get("spent", 0)) for b in budgets)
        
        # Calculate budget percentage
        if budget_limit > 0:
            budget_percent = (budget_used / budget_limit) * 100.0
        else:
            budget_percent = 0.0
        
        result.append(DashboardGroup(
            group_id=group_id,
            name=group.get("name", ""),
            type=group.get("type", "other"),
            your_balance=round(float(user_balance), 2),
            total_spent=round(total_spent, 2),
            member_count=len(group.get("members", [])),
            budget_percent=round(budget_percent, 2)
        ))
    
    return result
