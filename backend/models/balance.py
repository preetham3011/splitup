"""
Balance-related Pydantic models
"""

from pydantic import BaseModel, Field
from typing import List


class PersonBalance(BaseModel):
    """Balance information for a specific person"""
    user_id: str
    name: str
    amount: float = Field(..., description="Positive = they owe you, Negative = you owe them")


class SettlementRequest(BaseModel):
    """Request model for recording a settlement transaction"""
    from_user: str = Field(..., alias="from", description="User ID of debtor (person who owed)")
    to_user: str = Field(..., alias="to", description="User ID of creditor (person who was owed)")
    amount: float = Field(..., gt=0, description="Amount being settled (must be > 0)")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "from": "user_123",
                "to": "user_456",
                "amount": 250.0
            }
        }


class BalanceResponse(BaseModel):
    """Response model for user's balance in a group"""
    group_id: str
    your_balance: float = Field(
        ...,
        description="Your total balance: positive = you are owed, negative = you owe"
    )
    you_owe: float = Field(..., ge=0, description="Total amount you owe to others")
    you_are_owed: float = Field(..., ge=0, description="Total amount others owe you")
    people_you_owe: List[PersonBalance] = Field(
        default_factory=list,
        description="List of people you owe money to"
    )
    people_who_owe_you: List[PersonBalance] = Field(
        default_factory=list,
        description="List of people who owe you money"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "group_id": "group_123",
                "your_balance": -800.0,
                "you_owe": 1250.0,
                "you_are_owed": 450.0,
                "people_you_owe": [
                    {"user_id": "user_456", "name": "Mike Ross", "amount": 1250.0}
                ],
                "people_who_owe_you": [
                    {"user_id": "user_789", "name": "Sarah Chen", "amount": 450.0}
                ]
            }
        }
