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
    TransactionPatch,
    TransferIn,
    TransferOut,
)
from pennies import service
from pennies.settings import load_settings

bearer = HTTPBearer(auto_error=False)


def create_app(database_url: str | None = None, clock=None) -> FastAPI:
    settings = load_settings()
    engine = make_engine(database_url or settings.resolved_database_url())
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
        account = service.create_account(db, user_sub, body.name, body.opening_balance)
        return _account_out(account, body.opening_balance)

    @app.get("/accounts", response_model=list[AccountOut])
    def get_accounts(db=Depends(get_db), user_sub: str = Depends(get_current_user)):
        return [
            _account_out(account, balance) for account, balance in service.list_accounts(db, user_sub)
        ]

    @app.post("/transactions", response_model=TransactionOut)
    def post_transaction(
        body: TransactionIn,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        return service.create_transaction(
            db,
            user_sub,
            body.account_id,
            body.amount,
            body.category,
            body.vendor,
            body.note,
            body.occurred_at,
        )

    @app.get("/transactions", response_model=list[TransactionOut])
    def get_transactions(db=Depends(get_db), user_sub: str = Depends(get_current_user)):
        return service.list_transactions(db, user_sub)

    @app.patch("/transactions/{transaction_id}", response_model=TransactionOut)
    def patch_transaction(
        transaction_id: UUID,
        body: TransactionPatch,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        return service.update_category(db, user_sub, transaction_id, body.category)

    @app.post("/transfers", response_model=TransferOut)
    def post_transfer(
        body: TransferIn,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        outflow, inflow = service.create_transfer(
            db,
            user_sub,
            body.from_account_id,
            body.to_account_id,
            body.amount,
            body.occurred_at,
            body.note,
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
        occurred_at = body.occurred_at or request.app.state.clock()
        current, adjustment = service.reconcile(
            db, user_sub, account_id, body.real_balance, occurred_at
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
        _check_month(year, month)
        budget = service.set_budget(db, user_sub, year, month, body.amount)
        return {"year": budget.year, "month": budget.month, "amount": budget.amount}

    @app.get("/monthly-budgets/{year}/{month}", response_model=BudgetOut)
    def get_budget_route(
        year: int,
        month: int,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        _check_month(year, month)
        budget = service.get_budget(db, user_sub, year, month)
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
        return service.dashboard(db, user_sub, request.app.state.clock())

    return app


def _account_out(account, balance):
    return {
        "id": account.id,
        "name": account.name,
        "opening_balance": account.opening_balance,
        "calculated_balance": balance,
    }


def _check_month(year: int, month: int) -> None:
    if year < 2000 or year > 2100 or month < 1 or month > 12:
        raise DomainError("Month must be a calendar month from 2000 to 2100")
