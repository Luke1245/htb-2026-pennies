from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from pennies.auth import require_user
from pennies.db import make_engine, make_session_factory, session_scope
from pennies.errors import DomainError
from pennies.models import Base
from pennies.budgets import get_budget, set_budget
from pennies.calendar import YearMonth
from pennies.dashboard import dashboard
from pennies.ledger import (
    NewAccount,
    NewTransaction,
    NewTransfer,
    ReconciliationRequest,
    create_account,
    create_transaction,
    create_transfer,
    list_accounts,
    list_transactions,
    reconcile,
    update_category,
)
from pennies.schemas import (
    AccountIn,
    AccountOut,
    BudgetIn,
    BudgetOut,
    DashboardOut,
    ReconciliationIn,
    ReconciliationOut,
    TransactionIn,
    TransactionOut,
    TransactionPage,
    TransactionPatch,
    TransferIn,
    TransferOut,
)
from pennies.settings import load_settings

bearer = HTTPBearer(auto_error=False)


def create_app(database_url: str | None = None, clock=None) -> FastAPI:
    settings = load_settings()
    engine = make_engine(database_url or settings.required_database_url())
    Base.metadata.create_all(engine)
    get_db = session_scope(make_session_factory(engine))
    domain = settings.auth0_domain.strip() or None
    audience = settings.auth0_audience.strip() or None

    def get_current_user(
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    ) -> str:
        return require_user(credentials, domain, audience)

    app = FastAPI(title="Pennies")
    app.state.clock = clock or (lambda: datetime.now(timezone.utc))
    app.state.get_current_user = get_current_user
    origins = settings.cors_origin_list()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(DomainError)
    def handle_domain_error(_request: Request, exc: DomainError):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/accounts", response_model=AccountOut)
    def post_account(
        body: AccountIn,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        account = create_account(db, user_sub, NewAccount(body.name, body.opening_balance))
        return _account_out(account, body.opening_balance)

    @app.get("/accounts", response_model=list[AccountOut])
    def get_accounts(db=Depends(get_db), user_sub: str = Depends(get_current_user)):
        return [
            _account_out(account, balance) for account, balance in list_accounts(db, user_sub)
        ]

    @app.post("/transactions", response_model=TransactionOut)
    def post_transaction(
        body: TransactionIn,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        return create_transaction(
            db,
            user_sub,
            NewTransaction(
                account_id=body.account_id,
                amount=body.amount,
                category=body.category,
                vendor=body.vendor,
                note=body.note,
                occurred_at=body.occurred_at,
            ),
        )

    @app.get("/transactions", response_model=TransactionPage)
    def get_transactions(
        limit: int = 50,
        offset: int = 0,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        transactions, next_offset = list_transactions(db, user_sub, limit, offset)
        return {"transactions": transactions, "next_offset": next_offset}

    @app.patch("/transactions/{transaction_id}", response_model=TransactionOut)
    def patch_transaction(
        transaction_id: UUID,
        body: TransactionPatch,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        return update_category(db, user_sub, transaction_id, body.category)

    @app.post("/transfers", response_model=TransferOut)
    def post_transfer(
        body: TransferIn,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        outflow, inflow = create_transfer(
            db,
            user_sub,
            NewTransfer(
                from_account_id=body.from_account_id,
                to_account_id=body.to_account_id,
                amount=body.amount,
                occurred_at=body.occurred_at,
                note=body.note,
            ),
        )
        return {"id": outflow.transfer_id, "outflow": outflow, "inflow": inflow}

    @app.post("/accounts/{account_id}/reconciliations", response_model=ReconciliationOut)
    def post_reconciliation(
        account_id: UUID,
        body: ReconciliationIn,
        request: Request,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        current, adjustment = reconcile(
            db,
            user_sub,
            ReconciliationRequest(
                account_id,
                body.real_balance,
                body.occurred_at or request.app.state.clock(),
            ),
        )
        return {
            "calculated_balance": current,
            "real_balance": body.real_balance,
            "adjustment": adjustment,
        }

    @app.put("/monthly-budgets/{year}/{month}", response_model=BudgetOut)
    def put_budget(
        year: int,
        month: int,
        body: BudgetIn,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        budget = set_budget(db, user_sub, YearMonth(year, month), body.amount)
        return {"year": budget.year, "month": budget.month, "amount": budget.amount}

    @app.get("/monthly-budgets/{year}/{month}", response_model=BudgetOut)
    def get_budget_route(
        year: int,
        month: int,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        period = YearMonth(year, month)
        budget = get_budget(db, user_sub, period)
        return {
            "year": year,
            "month": month,
            "amount": None if budget is None else budget.amount,
        }

    @app.get("/dashboard", response_model=DashboardOut)
    def get_dashboard(
        request: Request,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        return dashboard(db, user_sub, request.app.state.clock())

    return app


def _account_out(account, balance):
    return {
        "id": account.id,
        "name": account.name,
        "opening_balance": account.opening_balance,
        "calculated_balance": balance,
    }

