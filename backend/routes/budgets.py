"""
Budget management routes

Provides CRUD-style endpoints for group budgets.
Budgets are MongoDB-only and use helpers from data.storage.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List

from pydantic import BaseModel, Field

from data.storage import (
    get_group_by_id,
    get_budgets_with_spent_for_group,
    create_or_update_budget,
    delete_budget,
)
from routes.auth import get_current_user_optional

router = APIRouter()


class BudgetBase(BaseModel):
    """Common fields for creating/updating a budget."""

    category: str = Field(..., min_length=1, description="Budget category name")
    limit: float = Field(..., gt=0, description="Spending limit for this category")


class BudgetCreate(BudgetBase):
    """Request model for creating a budget."""

    pass


class BudgetUpdate(BudgetBase):
    """Request model for updating a budget."""

    pass


async def _validate_group_membership(group_id: str, current_user: dict):
    """
    Helper function to validate that current user is a member of the group.
    Raises HTTPException if group doesn't exist or user is not a member.
    Returns the group if valid.
    """
    group = await get_group_by_id(group_id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Group with ID '{group_id}' not found",
        )

    is_member = any(
        member.get("user_id") == current_user["id"]
        for member in group.get("members", [])
    )

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group",
        )

    return group


@router.get(
    "/groups/{group_id}/budgets",
    response_model=List[dict],
)
async def list_budgets(group_id: str, current_user: dict = Depends(get_current_user_optional)):
    """
    List all budgets for a group with spent/remaining/percentage_used.

    - Uses MongoDB-only helpers (no in-memory fallback).
    - Returns an empty list if no budgets exist.
    """
    await _validate_group_membership(group_id, current_user)

    budgets = await get_budgets_with_spent_for_group(group_id)
    return budgets


@router.post(
    "/groups/{group_id}/budgets",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def create_budget(group_id: str, budget_data: BudgetCreate, current_user: dict = Depends(get_current_user_optional)):
    """
    Create or update a budget for a group.

    - Injects group_id into the budget payload.
    - Uses MongoDB-only helper and fails if MongoDB is unavailable.
    """
    await _validate_group_membership(group_id, current_user)

    budget = {
        "group_id": group_id,
        "category": budget_data.category,
        "limit": budget_data.limit,
    }

    budget_doc = await create_or_update_budget(budget)
    return budget_doc


@router.put(
    "/budgets/{budget_id}",
    response_model=dict,
)
async def update_budget(budget_id: str, budget_data: BudgetUpdate):
    """
    Update an existing budget.

    - Uses budget_id path parameter to target the budget.
    - Only category and limit are updated.
    - Uses MongoDB-only helper and fails if MongoDB is unavailable.
    """
    budget = {
        "id": budget_id,
        "category": budget_data.category,
        "limit": budget_data.limit,
    }

    budget_doc = await create_or_update_budget(budget)
    return budget_doc


@router.delete(
    "/budgets/{budget_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_budget_route(budget_id: str):
    """
    Delete a budget by ID.

    - Uses MongoDB-only helper and fails if MongoDB is unavailable.
    - Returns a simple success response regardless of whether a budget was deleted.
    """
    await delete_budget(budget_id)
    return {"success": True}

