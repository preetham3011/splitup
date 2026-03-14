"""
Expense-related Pydantic models
"""

from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Union, Any
from datetime import datetime


class ExpenseSplit(BaseModel):
    """Information about how an expense is split"""
    user_id: str
    amount_owed: float = Field(..., ge=0, description="Amount this user owes for this expense")


class ExpenseCreate(BaseModel):
    """Request model for creating an expense"""
    title: str = Field(..., min_length=1, max_length=200, description="Expense title/description")
    amount: float = Field(..., gt=0, description="Total expense amount")
    paid_by: str = Field(..., description="User ID of person who paid")
    category: str = Field(default="Other", description="Expense category")
    split_type: Literal["equal", "exact", "percentage"] = Field(
        default="equal",
        description="How to split the expense (equal, exact, or percentage)"
    )
    split: Optional[dict] = Field(
        default=None,
        description="Optional split configuration. If not provided, defaults to equal split among all members."
    )
    date: datetime = Field(default_factory=datetime.now, description="Date of expense")


class ExpenseResponse(BaseModel):
    """Response model for expense details"""
    id: str
    group_id: str
    title: str
    amount: float
    paid_by: str  # user_id
    paid_by_name: str  # name of person who paid
    category: str
    split_type: str
    date: datetime
    created_at: datetime
    created_by: str  # user_id who created the expense
    splits: List[ExpenseSplit]  # How the expense is split among members

    class Config:
        json_schema_extra = {
            "example": {
                "id": "expense_123",
                "group_id": "group_123",
                "title": "Dinner at SpiceHub",
                "amount": 1200.0,
                "paid_by": "user_123",
                "paid_by_name": "Test User",
                "category": "Food",
                "split_type": "equal",
                "date": "2024-01-15T19:00:00",
                "created_at": "2024-01-15T19:30:00",
                "created_by": "user_123",
                "splits": [
                    {"user_id": "user_123", "amount_owed": 400.0},
                    {"user_id": "user_456", "amount_owed": 400.0},
                    {"user_id": "user_789", "amount_owed": 400.0}
                ]
            }
        }
