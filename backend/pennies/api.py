from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from pennies.auth import require_user
from pennies.db import ensure_schema, make_engine, make_session_factory, session_scope
from pennies.errors import DomainError
from pennies.budgets import get_budget, set_budget
from pennies.calendar import YearMonth
from pennies.dashboard import dashboard
from pennies.money import money_str
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
from pennies.guides import list_guides
from pennies.reading import (
    UnavailableReader,
    assigned_category,
    build_reading,
    current_reading,
    set_sharing_mode,
    sharing_mode,
    transaction_facts,
)
from pennies.subscriptions import (
    SubscriptionCommand,
    create_subscription,
    delete_subscription,
    list_subscriptions,
    update_subscription,
)
from pennies.users import display_name_for, set_display_name
from pennies.schemas import (
    AccountIn,
    AccountOut,
    BudgetIn,
    BudgetOut,
    DashboardOut,
    ReconciliationIn,
    ReconciliationOut,
    CategorySuggestionIn,
    CategorySuggestionOut,
    TransactionIn,
    TransactionOut,
    TransactionPage,
    TransactionPatch,
    TransferIn,
    TransferOut,
    SubscriptionIn,
    SubscriptionOut,
    SharingIn,
    SharingOut,
    ReadingOut,
    ProfileIn,
    ProfileOut,
)
from pennies.settings import load_settings

bearer = HTTPBearer(auto_error=False)


def create_app(database_url: str | None = None, clock=None, reader=None) -> FastAPI:
    settings = load_settings()
    engine = make_engine(database_url or settings.required_database_url())
    ensure_schema(engine)
    get_db = session_scope(make_session_factory(engine))
    if reader is None:
        if settings.gemini_api_key.strip():
            from pennies.gemini import GeminiReader

            reader = GeminiReader(settings.gemini_api_key.strip(), settings.gemini_model.strip() or "gemini-3.5-flash")
        else:
            reader = UnavailableReader()
    domain = settings.auth0_domain.strip() or None
    audience = settings.auth0_audience.strip() or None

    def get_current_user(
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    ) -> str:
        return require_user(credentials, domain, audience)

    app = FastAPI(title="Pennies")
    app.state.clock = clock or (lambda: datetime.now(timezone.utc))
    app.state.reader = reader
    app.state.category_cache = {}
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

    @app.get("/me", response_model=ProfileOut)
    def get_me(db=Depends(get_db), user_sub: str = Depends(get_current_user)):
        return {"display_name": display_name_for(db, user_sub)}

    @app.put("/me", response_model=ProfileOut)
    def put_me(
        body: ProfileIn,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        return {"display_name": set_display_name(db, user_sub, body.display_name)}

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
        request: Request,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        category, source = assigned_category(
            request.app.state.reader,
            transaction_facts(body.vendor, body.amount, body.note, body.occurred_at),
            request.app.state.category_cache,
        )
        return create_transaction(
            db,
            user_sub,
            NewTransaction(
                account_id=body.account_id,
                amount=body.amount,
                category=category,
                vendor=body.vendor,
                note=body.note,
                occurred_at=body.occurred_at,
            ),
            source,
        )

    @app.post("/category-suggestions", response_model=CategorySuggestionOut)
    def post_category_suggestion(
        body: CategorySuggestionIn,
        request: Request,
        _user_sub: str = Depends(get_current_user),
    ):
        facts = {"vendor": body.vendor, "note": body.note}
        if body.amount is not None:
            facts["amount"] = money_str(body.amount)
        category, _source = assigned_category(
            request.app.state.reader,
            facts,
            request.app.state.category_cache,
        )
        return {"category": category}

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

    @app.get("/guides")
    def get_guides(_user_sub: str = Depends(get_current_user)):
        return list_guides()

    @app.get("/subscriptions", response_model=list[SubscriptionOut])
    def get_subscriptions(db=Depends(get_db), user_sub: str = Depends(get_current_user)):
        return list_subscriptions(db, user_sub)

    @app.post("/subscriptions", response_model=SubscriptionOut)
    def post_subscription(
        body: SubscriptionIn,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        return create_subscription(db, user_sub, _subscription_command(body))

    @app.put("/subscriptions/{subscription_id}", response_model=SubscriptionOut)
    def put_subscription(
        subscription_id: UUID,
        body: SubscriptionIn,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        return update_subscription(db, user_sub, subscription_id, _subscription_command(body))

    @app.delete("/subscriptions/{subscription_id}")
    def remove_subscription(
        subscription_id: UUID,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        delete_subscription(db, user_sub, subscription_id)
        return {"deleted": True}

    @app.get("/sharing-mode", response_model=SharingOut)
    def get_sharing_mode(db=Depends(get_db), user_sub: str = Depends(get_current_user)):
        return {"mode": sharing_mode(db, user_sub)}

    @app.put("/sharing-mode", response_model=SharingOut)
    def put_sharing_mode(
        body: SharingIn,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        return {"mode": set_sharing_mode(db, user_sub, body.mode)}

    @app.get("/reading", response_model=ReadingOut)
    def get_reading(db=Depends(get_db), user_sub: str = Depends(get_current_user)):
        return {"sharing_mode": sharing_mode(db, user_sub), "updated": False, "reading": current_reading(db, user_sub)}

    @app.post("/reading", response_model=ReadingOut)
    def post_reading(
        request: Request,
        db=Depends(get_db),
        user_sub: str = Depends(get_current_user),
    ):
        reading, updated = build_reading(db, user_sub, request.app.state.clock(), request.app.state.reader)
        return {"sharing_mode": sharing_mode(db, user_sub), "updated": updated, "reading": reading}

    return app


def _subscription_command(body) -> SubscriptionCommand:
    return SubscriptionCommand(body.name, body.amount, body.year, body.month)


def _account_out(account, balance):
    return {
        "id": account.id,
        "name": account.name,
        "opening_balance": account.opening_balance,
        "calculated_balance": balance,
    }

