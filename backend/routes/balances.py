"""
Balance calculation routes

Calculates how much users owe each other based on expenses.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, List

from models.balance import BalanceResponse, PersonBalance, SettlementRequest
from data.storage import (
    groups_storage,
    expenses_storage,
    get_user_name,
    get_group_by_id,
    get_group_expenses,
    compute_group_balances,
    compute_settlements_from_balances,
    generate_settlement_id,
    create_settlement_in_mongo,
    get_group_settlements,
)
from routes.auth import get_current_user_optional
from decimal import Decimal

router = APIRouter(prefix="/groups/{group_id}/balances")


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


@router.get("", response_model=BalanceResponse)
async def get_balances(group_id: str, current_user: dict = Depends(get_current_user_optional)):
    """
    Get balance summary for the current user in a group
    
    Calculates:
    - **your_balance**: Total balance (positive = you are owed, negative = you owe)
    - **you_owe**: Total amount you owe to others
    - **you_are_owed**: Total amount others owe you
    - **people_you_owe**: List of people you owe money to
    - **people_who_owe_you**: List of people who owe you money
    
    Balance calculation logic:
    1. For each expense, if you paid, you are owed by others
    2. If someone else paid, you owe your share
    3. Net balance = (amount you are owed) - (amount you owe)
    """
    # Validate group exists and user is a member
    group = await _validate_group_membership(group_id, current_user)
    
    # CANONICAL BALANCE COMPUTATION - This is the ONLY source of truth
    # Includes both expenses AND settlements
    all_balances = await compute_group_balances(group_id)
    current_user_id = current_user["id"]
    
    # Get current user's balance from canonical computation
    current_user_balance = all_balances.get(current_user_id, Decimal('0'))
    
    # Build relative balance view for current user
    # We need to show who the current user owes and who owes them
    # This requires looking at pairwise relationships from expenses and settlements
    
    # Get expenses and settlements to build pairwise relationships
    group_expenses = await get_group_expenses(group_id)
    
    # Build pairwise balance map (current_user <-> other_user)
    balance_map_float: Dict[str, float] = {}
    
    for expense in group_expenses:
        paid_by = expense.get("paid_by")
        
        # Use split_participants if available, otherwise fall back to splits
        split_participants = expense.get("split_participants", [])
        if not split_participants:
            splits = expense.get("splits", [])
            split_participants = [{"user_id": s["user_id"], "share": s["amount_owed"]} for s in splits]
        
        if paid_by == current_user_id:
            # Current user paid: others owe current user their share
            for participant in split_participants:
                split_user_id = participant.get("user_id")
                share = float(participant.get("share", 0))
                
                if split_user_id != current_user_id:
                    balance_map_float[split_user_id] = balance_map_float.get(split_user_id, 0) + share
        else:
            # Someone else paid: current user owes their share to the payer
            for participant in split_participants:
                split_user_id = participant.get("user_id")
                share = float(participant.get("share", 0))
                
                if split_user_id == current_user_id:
                    balance_map_float[paid_by] = balance_map_float.get(paid_by, 0) - share
                    break
    
    # Now apply settlements to adjust the pairwise balances
    settlements = await get_group_settlements(group_id)
    
    for settlement in settlements:
        from_user = settlement.get("from")
        to_user = settlement.get("to")
        amount = float(settlement.get("amount", 0))
        
        # If current user was the debtor (from), their debt decreases
        if from_user == current_user_id and to_user in balance_map_float:
            balance_map_float[to_user] += amount
        # If current user was the creditor (to), the amount owed to them decreases
        elif to_user == current_user_id and from_user in balance_map_float:
            balance_map_float[from_user] -= amount
    
    # Calculate totals from pairwise balances
    you_owe = 0.0
    you_are_owed = 0.0
    people_you_owe: List[PersonBalance] = []
    people_who_owe_you: List[PersonBalance] = []
    
    for user_id, balance in balance_map_float.items():
        if balance < 0:
            amount = abs(balance)
            you_owe += amount
            people_you_owe.append(
                PersonBalance(
                    user_id=user_id,
                    name=await get_user_name(user_id),
                    amount=amount
                )
            )
        elif balance > 0:
            you_are_owed += balance
            people_who_owe_you.append(
                PersonBalance(
                    user_id=user_id,
                    name=await get_user_name(user_id),
                    amount=balance
                )
            )
    
    # Use canonical balance for overall balance
    your_balance = float(current_user_balance)
    
    people_you_owe.sort(key=lambda x: x.amount, reverse=True)
    people_who_owe_you.sort(key=lambda x: x.amount, reverse=True)
    
    your_balance = round(your_balance, 2)
    you_owe = round(you_owe, 2)
    you_are_owed = round(you_are_owed, 2)
    
    return BalanceResponse(
        group_id=group_id,
        your_balance=your_balance,
        you_owe=you_owe,
        you_are_owed=you_are_owed,
        people_you_owe=people_you_owe,
        people_who_owe_you=people_who_owe_you
    )


@router.get("/settlements")
async def get_settlements(group_id: str, current_user: dict = Depends(get_current_user_optional)):
    """
    Get suggested settlement transactions for the group
    
    Calculates the minimum number of transactions needed to settle all balances
    using a greedy algorithm. Returns a list of transactions showing who should
    pay whom and how much.
    
    IMPORTANT: Only includes users with non-zero balances.
    If A owes B only, C (with zero balance) will NOT appear.
    
    Returns:
        List of settlement transactions with 'from', 'to', 'amount', and user names
    """
    # Validate group exists and user is a member
    await _validate_group_membership(group_id, current_user)
    
    # Compute group balances (already includes settlement adjustments)
    balances = await compute_group_balances(group_id)
    
    # Filter out zero balances before computing settlements
    # Only include users who actually have outstanding debts
    from decimal import Decimal
    non_zero_balances = {
        user_id: balance 
        for user_id, balance in balances.items() 
        if abs(balance) > Decimal('0.01')  # Tolerance for rounding
    }
    
    # Compute settlements from non-zero balances only
    settlements = compute_settlements_from_balances(non_zero_balances)
    
    # Enrich with user names and convert Decimal to float
    enriched_settlements = []
    for settlement in settlements:
        amount = float(settlement["amount"])
        # Only include settlements with amount > 0
        if amount > 0:
            enriched_settlements.append({
                "from": settlement["from"],
                "from_name": await get_user_name(settlement["from"]),
                "to": settlement["to"],
                "to_name": await get_user_name(settlement["to"]),
                "amount": amount
            })
    
    return {
        "group_id": group_id,
        "settlements": enriched_settlements,
        "total_transactions": len(enriched_settlements)
    }


@router.post("/settlements", status_code=status.HTTP_201_CREATED)
async def record_settlement(
    group_id: str,
    settlement_data: dict,
    current_user: dict = Depends(get_current_user_optional)
):
    """
    Record a settlement transaction
    
    Settlements are NOT expenses. They resolve debt created by expenses.
    They do NOT affect total spent or budgets.
    
    Expected body:
    {
        "from": "user_id",  // Debtor (person who owed)
        "to": "user_id",    // Creditor (person who was owed)
        "amount": 250.00
    }
    
    Returns:
        Updated balances after recording the settlement
    """
    # Validate group exists and user is a member
    await _validate_group_membership(group_id, current_user)
    
    # Validate settlement data
    from_user = settlement_data.get("from")
    to_user = settlement_data.get("to")
    amount = settlement_data.get("amount")
    
    if not from_user or not to_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both 'from' and 'to' user IDs are required"
        )
    
    if not amount or amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be greater than 0"
        )
    
    # Create settlement record
    from datetime import datetime
    settlement_id = generate_settlement_id()
    settlement = {
        "id": settlement_id,
        "group_id": group_id,
        "from": from_user,
        "to": to_user,
        "amount": amount,
        "created_at": datetime.now(),
    }
    
    # Save to MongoDB
    await create_settlement_in_mongo(settlement)
    
    # Recompute balances (will now include this settlement)
    balances = await compute_group_balances(group_id)
    
    # Convert to float for response
    balances_response = {
        user_id: float(balance)
        for user_id, balance in balances.items()
    }
    
    return {
        "success": True,
        "settlement_id": settlement_id,
        "group_id": group_id,
        "from": from_user,
        "to": to_user,
        "amount": amount,
        "balances": balances_response
    }
