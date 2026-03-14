"""
Group-related Pydantic models
"""

from pydantic import BaseModel, Field
from typing import List, Literal
from datetime import datetime


class GroupMember(BaseModel):
    """Member information in a group"""
    user_id: str
    name: str
    role: Literal["admin", "member"] = "member"
    joined_at: datetime


class GroupCreate(BaseModel):
    """Request model for creating a group"""
    name: str = Field(..., min_length=1, max_length=100, description="Group name")
    type: Literal["home", "trip", "couple", "other"] = Field(
        default="other",
        description="Type of group"
    )
    currency: str = Field(default="INR", description="Currency code")
    simplify_debts: bool = Field(default=True, description="Enable debt simplification")


class GroupJoin(BaseModel):
    """Request model for joining a group"""
    invite_code: str = Field(..., min_length=1, description="Group invite code")


class GroupResponse(BaseModel):
    """Response model for group details"""
    id: str
    name: str
    type: str
    invite_code: str
    currency: str
    simplify_debts: bool
    created_at: datetime
    created_by: str  # user_id of creator
    members: List[GroupMember]
    member_count: int

    class Config:
        json_schema_extra = {
            "example": {
                "id": "group_123",
                "name": "Apartment 402",
                "type": "home",
                "invite_code": "X8J2-9K",
                "currency": "INR",
                "simplify_debts": True,
                "created_at": "2024-01-01T00:00:00",
                "created_by": "user_123",
                "members": [
                    {
                        "user_id": "user_123",
                        "name": "Test User",
                        "role": "admin",
                        "joined_at": "2024-01-01T00:00:00"
                    }
                ],
                "member_count": 1
            }
        }
