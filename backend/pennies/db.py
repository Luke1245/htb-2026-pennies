from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


def normalize_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgres://")
    if database_url.startswith("postgresql://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgresql://")
    return database_url


def make_engine(database_url: str) -> Engine:
    url = normalize_url(database_url)
    kwargs = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if ":memory:" in url or url in {"sqlite://", "sqlite:///"}:
            kwargs["poolclass"] = StaticPool
    return create_engine(url, **kwargs)


def ensure_schema(engine: Engine) -> None:
    from pennies.models import Base

    Base.metadata.create_all(engine)
    if not inspect(engine).has_table("transactions"):
        return
    columns = {column["name"] for column in inspect(engine).get_columns("transactions")}
    if "category_source" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE transactions ADD COLUMN category_source VARCHAR(20)"))


def make_session_factory(engine: Engine):
    return sessionmaker(bind=engine, expire_on_commit=False)


def session_scope(factory):
    def get_db():
        db: Session = factory()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    return get_db
