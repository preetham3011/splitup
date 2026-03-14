"""
Debug test routes for automated balance/settlement verification

This module contains test endpoints that run automated test cases
to verify the correctness of expense split, balance computation,
and settlement algorithms.

ONLY enabled when DEBUG mode is active.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from decimal import Decimal
from datetime import datetime
import os

from data.storage import (
    generate_group_id,
    generate_expense_id,
    create_group_in_mongo,
    create_expense_in_mongo,
    delete_group_and_related_data,
    normalize_expense_split,
    compute_group_balances,
    compute_settlements_from_balances,
)

router = APIRouter(prefix="/api/debug")

# Check if DEBUG mode is enabled
DEBUG_ENABLED = os.getenv("DEBUG", "false").lower() == "true"


def _format_decimal(d: Decimal) -> str:
    """Format Decimal for comparison in test results"""
    return f"{float(d):.2f}"


async def _create_test_group(member_ids: List[str]) -> dict:
    """Create a test group with specified members"""
    group_id = generate_group_id()
    
    members = []
    for i, user_id in enumerate(member_ids):
        members.append({
            "user_id": user_id,
            "name": f"User {user_id}",
            "role": "admin" if i == 0 else "member",
            "joined_at": datetime.now()
        })
    
    group = {
        "id": group_id,
        "name": f"Test Group {group_id}",
        "type": "other",
        "invite_code": "TEST-00",
        "currency": "USD",
        "simplify_debts": True,
        "created_at": datetime.now(),
        "created_by": member_ids[0],
        "members": members
    }
    
    await create_group_in_mongo(group)
    return group


async def _create_test_expense(
    group: dict,
    amount: float,
    paid_by: str,
    split_input: dict = None
) -> dict:
    """Create a test expense with specified parameters"""
    expense_id = generate_expense_id()
    
    # Normalize the split
    split_type, split_participants, raw_split_input = normalize_expense_split(
        amount=amount,
        paid_by=paid_by,
        group_members=group["members"],
        split_input=split_input
    )
    
    # Convert to legacy format
    splits = [
        {"user_id": p["user_id"], "amount_owed": float(p["share"])}
        for p in split_participants
    ]
    
    expense = {
        "id": expense_id,
        "group_id": group["id"],
        "title": f"Test Expense {expense_id}",
        "amount": amount,
        "paid_by": paid_by,
        "category": "Test",
        "split_type": split_type,
        "date": datetime.now(),
        "created_at": datetime.now(),
        "created_by": paid_by,
        "splits": splits,
        "split_participants": [
            {"user_id": p["user_id"], "share": float(p["share"])}
            for p in split_participants
        ],
        "raw_split_input": raw_split_input
    }
    
    await create_expense_in_mongo(expense)
    return expense


def _compare_balances(actual: Dict[str, Decimal], expected: Dict[str, float], tolerance: float = 0.01) -> tuple:
    """Compare actual balances with expected, return (passed, details)"""
    details = {}
    all_users = set(actual.keys()) | set(expected.keys())
    
    passed = True
    for user_id in all_users:
        actual_val = float(actual.get(user_id, Decimal('0')))
        expected_val = expected.get(user_id, 0.0)
        diff = abs(actual_val - expected_val)
        
        match = diff <= tolerance
        if not match:
            passed = False
        
        details[user_id] = {
            "expected": expected_val,
            "actual": actual_val,
            "diff": diff,
            "match": match
        }
    
    return passed, details


def _compare_settlements(actual: List[dict], expected: List[dict], tolerance: float = 0.01) -> tuple:
    """Compare actual settlements with expected, return (passed, details)"""
    # Sort both by from -> to for comparison
    actual_sorted = sorted(actual, key=lambda x: (x["from"], x["to"]))
    expected_sorted = sorted(expected, key=lambda x: (x["from"], x["to"]))
    
    if len(actual_sorted) != len(expected_sorted):
        return False, {
            "error": f"Different number of settlements: expected {len(expected_sorted)}, got {len(actual_sorted)}",
            "expected": expected_sorted,
            "actual": actual_sorted
        }
    
    passed = True
    details = []
    
    for i, (actual_s, expected_s) in enumerate(zip(actual_sorted, expected_sorted)):
        actual_amount = float(actual_s["amount"])
        expected_amount = float(expected_s["amount"])
        diff = abs(actual_amount - expected_amount)
        
        match = (
            actual_s["from"] == expected_s["from"] and
            actual_s["to"] == expected_s["to"] and
            diff <= tolerance
        )
        
        if not match:
            passed = False
        
        details.append({
            "index": i,
            "expected": expected_s,
            "actual": {
                "from": actual_s["from"],
                "to": actual_s["to"],
                "amount": actual_amount
            },
            "match": match
        })
    
    return passed, {"settlements": details}


@router.post("/run-balance-tests")
async def run_balance_tests():
    """
    Run automated test cases A-F for balance and settlement computation.
    
    Returns detailed results for each test case including pass/fail status.
    """
    if not DEBUG_ENABLED:
        raise HTTPException(status_code=403, detail="Debug endpoints are disabled")
    
    results = {
        "timestamp": datetime.now().isoformat(),
        "test_cases": {},
        "summary": {
            "total": 0,
            "passed": 0,
            "failed": 0
        }
    }
    
    # ========================================================================
    # TEST CASE A: 2-member equal split
    # ========================================================================
    try:
        group_a = await _create_test_group(["A", "B"])
        expense_a = await _create_test_expense(group_a, 500.0, "A", None)
        
        balances_a = await compute_group_balances(group_a["id"])
        settlements_a = compute_settlements_from_balances(balances_a)
        
        expected_balances_a = {"A": 250.0, "B": -250.0}
        expected_settlements_a = [{"from": "B", "to": "A", "amount": 250.0}]
        
        balances_passed, balances_details = _compare_balances(balances_a, expected_balances_a)
        settlements_passed, settlements_details = _compare_settlements(settlements_a, expected_settlements_a)
        
        test_passed = balances_passed and settlements_passed
        
        results["test_cases"]["A"] = {
            "name": "2-member equal split",
            "passed": test_passed,
            "expenses": [{"amount": 500.0, "paid_by": "A", "split": "equal among [A,B]"}],
            "balances": {
                "expected": expected_balances_a,
                "actual": {k: float(v) for k, v in balances_a.items()},
                "details": balances_details,
                "passed": balances_passed
            },
            "settlements": {
                "expected": expected_settlements_a,
                "actual": [{"from": s["from"], "to": s["to"], "amount": float(s["amount"])} for s in settlements_a],
                "details": settlements_details,
                "passed": settlements_passed
            }
        }
        
        # Cleanup
        await delete_group_and_related_data(group_a["id"])
        
    except Exception as e:
        results["test_cases"]["A"] = {
            "name": "2-member equal split",
            "passed": False,
            "error": str(e)
        }
    
    # ========================================================================
    # TEST CASE B: 3-member, subset split
    # ========================================================================
    try:
        group_b = await _create_test_group(["A", "B", "C"])
        expense_b = await _create_test_expense(
            group_b, 500.0, "A",
            {"type": "equal", "participants": ["A", "B"]}
        )
        
        balances_b = await compute_group_balances(group_b["id"])
        settlements_b = compute_settlements_from_balances(balances_b)
        
        expected_balances_b = {"A": 250.0, "B": -250.0, "C": 0.0}
        expected_settlements_b = [{"from": "B", "to": "A", "amount": 250.0}]
        
        balances_passed, balances_details = _compare_balances(balances_b, expected_balances_b)
        settlements_passed, settlements_details = _compare_settlements(settlements_b, expected_settlements_b)
        
        test_passed = balances_passed and settlements_passed
        
        results["test_cases"]["B"] = {
            "name": "3-member, subset split",
            "passed": test_passed,
            "expenses": [{"amount": 500.0, "paid_by": "A", "split": "equal among [A,B]"}],
            "balances": {
                "expected": expected_balances_b,
                "actual": {k: float(v) for k, v in balances_b.items()},
                "details": balances_details,
                "passed": balances_passed
            },
            "settlements": {
                "expected": expected_settlements_b,
                "actual": [{"from": s["from"], "to": s["to"], "amount": float(s["amount"])} for s in settlements_b],
                "details": settlements_details,
                "passed": settlements_passed
            }
        }
        
        await delete_group_and_related_data(group_b["id"])
        
    except Exception as e:
        results["test_cases"]["B"] = {
            "name": "3-member, subset split",
            "passed": False,
            "error": str(e)
        }
    
    # ========================================================================
    # TEST CASE C: Equal among 3
    # ========================================================================
    try:
        group_c = await _create_test_group(["A", "B", "C"])
        expense_c = await _create_test_expense(group_c, 300.0, "B", None)
        
        balances_c = await compute_group_balances(group_c["id"])
        settlements_c = compute_settlements_from_balances(balances_c)
        
        expected_balances_c = {"A": -100.0, "B": 200.0, "C": -100.0}
        expected_settlements_c = [
            {"from": "A", "to": "B", "amount": 100.0},
            {"from": "C", "to": "B", "amount": 100.0}
        ]
        
        balances_passed, balances_details = _compare_balances(balances_c, expected_balances_c)
        settlements_passed, settlements_details = _compare_settlements(settlements_c, expected_settlements_c)
        
        test_passed = balances_passed and settlements_passed
        
        results["test_cases"]["C"] = {
            "name": "Equal among 3",
            "passed": test_passed,
            "expenses": [{"amount": 300.0, "paid_by": "B", "split": "equal among [A,B,C]"}],
            "balances": {
                "expected": expected_balances_c,
                "actual": {k: float(v) for k, v in balances_c.items()},
                "details": balances_details,
                "passed": balances_passed
            },
            "settlements": {
                "expected": expected_settlements_c,
                "actual": [{"from": s["from"], "to": s["to"], "amount": float(s["amount"])} for s in settlements_c],
                "details": settlements_details,
                "passed": settlements_passed
            }
        }
        
        await delete_group_and_related_data(group_c["id"])
        
    except Exception as e:
        results["test_cases"]["C"] = {
            "name": "Equal among 3",
            "passed": False,
            "error": str(e)
        }
    
    # ========================================================================
    # TEST CASE D: Exact amounts
    # ========================================================================
    try:
        group_d = await _create_test_group(["A", "B", "C"])
        expense_d = await _create_test_expense(
            group_d, 370.0, "C",
            {
                "type": "exact",
                "participants": [
                    {"user_id": "A", "amount": 100},
                    {"user_id": "B", "amount": 120},
                    {"user_id": "C", "amount": 150}
                ]
            }
        )
        
        balances_d = await compute_group_balances(group_d["id"])
        settlements_d = compute_settlements_from_balances(balances_d)
        
        expected_balances_d = {"A": -100.0, "B": -120.0, "C": 220.0}
        expected_settlements_d = [
            {"from": "B", "to": "C", "amount": 120.0},
            {"from": "A", "to": "C", "amount": 100.0}
        ]
        
        balances_passed, balances_details = _compare_balances(balances_d, expected_balances_d)
        settlements_passed, settlements_details = _compare_settlements(settlements_d, expected_settlements_d)
        
        test_passed = balances_passed and settlements_passed
        
        results["test_cases"]["D"] = {
            "name": "Exact amounts",
            "passed": test_passed,
            "expenses": [{"amount": 370.0, "paid_by": "C", "split": "exact: A=100, B=120, C=150"}],
            "balances": {
                "expected": expected_balances_d,
                "actual": {k: float(v) for k, v in balances_d.items()},
                "details": balances_details,
                "passed": balances_passed
            },
            "settlements": {
                "expected": expected_settlements_d,
                "actual": [{"from": s["from"], "to": s["to"], "amount": float(s["amount"])} for s in settlements_d],
                "details": settlements_details,
                "passed": settlements_passed
            }
        }
        
        await delete_group_and_related_data(group_d["id"])
        
    except Exception as e:
        results["test_cases"]["D"] = {
            "name": "Exact amounts",
            "passed": False,
            "error": str(e)
        }
    
    # ========================================================================
    # TEST CASE E: Percentage
    # ========================================================================
    try:
        group_e = await _create_test_group(["A", "B", "C"])
        expense_e = await _create_test_expense(
            group_e, 1000.0, "A",
            {
                "type": "percentage",
                "participants": [
                    {"user_id": "A", "percent": 50},
                    {"user_id": "B", "percent": 30},
                    {"user_id": "C", "percent": 20}
                ]
            }
        )
        
        balances_e = await compute_group_balances(group_e["id"])
        settlements_e = compute_settlements_from_balances(balances_e)
        
        expected_balances_e = {"A": 500.0, "B": -300.0, "C": -200.0}
        expected_settlements_e = [
            {"from": "B", "to": "A", "amount": 300.0},
            {"from": "C", "to": "A", "amount": 200.0}
        ]
        
        balances_passed, balances_details = _compare_balances(balances_e, expected_balances_e)
        settlements_passed, settlements_details = _compare_settlements(settlements_e, expected_settlements_e)
        
        test_passed = balances_passed and settlements_passed
        
        results["test_cases"]["E"] = {
            "name": "Percentage",
            "passed": test_passed,
            "expenses": [{"amount": 1000.0, "paid_by": "A", "split": "percent: A=50%, B=30%, C=20%"}],
            "balances": {
                "expected": expected_balances_e,
                "actual": {k: float(v) for k, v in balances_e.items()},
                "details": balances_details,
                "passed": balances_passed
            },
            "settlements": {
                "expected": expected_settlements_e,
                "actual": [{"from": s["from"], "to": s["to"], "amount": float(s["amount"])} for s in settlements_e],
                "details": settlements_details,
                "passed": settlements_passed
            }
        }
        
        await delete_group_and_related_data(group_e["id"])
        
    except Exception as e:
        results["test_cases"]["E"] = {
            "name": "Percentage",
            "passed": False,
            "error": str(e)
        }
    
    # ========================================================================
    # TEST CASE F: Multi-expense netting
    # ========================================================================
    try:
        group_f = await _create_test_group(["A", "B", "C"])
        
        # Expense 1: A pays 500 split [A,B]
        expense_f1 = await _create_test_expense(
            group_f, 500.0, "A",
            {"type": "equal", "participants": ["A", "B"]}
        )
        
        # Expense 2: B pays 300 split [B,C]
        expense_f2 = await _create_test_expense(
            group_f, 300.0, "B",
            {"type": "equal", "participants": ["B", "C"]}
        )
        
        balances_f = await compute_group_balances(group_f["id"])
        settlements_f = compute_settlements_from_balances(balances_f)
        
        expected_balances_f = {"A": 250.0, "B": -100.0, "C": -150.0}
        expected_settlements_f = [
            {"from": "C", "to": "A", "amount": 150.0},
            {"from": "B", "to": "A", "amount": 100.0}
        ]
        
        balances_passed, balances_details = _compare_balances(balances_f, expected_balances_f)
        settlements_passed, settlements_details = _compare_settlements(settlements_f, expected_settlements_f)
        
        test_passed = balances_passed and settlements_passed
        
        results["test_cases"]["F"] = {
            "name": "Multi-expense netting",
            "passed": test_passed,
            "expenses": [
                {"amount": 500.0, "paid_by": "A", "split": "equal among [A,B]"},
                {"amount": 300.0, "paid_by": "B", "split": "equal among [B,C]"}
            ],
            "balances": {
                "expected": expected_balances_f,
                "actual": {k: float(v) for k, v in balances_f.items()},
                "details": balances_details,
                "passed": balances_passed
            },
            "settlements": {
                "expected": expected_settlements_f,
                "actual": [{"from": s["from"], "to": s["to"], "amount": float(s["amount"])} for s in settlements_f],
                "details": settlements_details,
                "passed": settlements_passed
            }
        }
        
        await delete_group_and_related_data(group_f["id"])
        
    except Exception as e:
        results["test_cases"]["F"] = {
            "name": "Multi-expense netting",
            "passed": False,
            "error": str(e)
        }
    
    # Calculate summary
    for test_case in results["test_cases"].values():
        results["summary"]["total"] += 1
        if test_case.get("passed", False):
            results["summary"]["passed"] += 1
        else:
            results["summary"]["failed"] += 1
    
    results["summary"]["all_passed"] = results["summary"]["failed"] == 0
    
    return results
