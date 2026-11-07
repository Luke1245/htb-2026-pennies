from decimal import Decimal, InvalidOperation

PENCE = Decimal("0.01")


def parse_money(value) -> Decimal:
    if isinstance(value, bool) or value is None:
        raise ValueError("Amount must be a decimal number of pounds")
    try:
        amount = Decimal(str(value).strip())
    except (InvalidOperation, AttributeError):
        raise ValueError("Amount must be a decimal number of pounds") from None
    if amount != amount.quantize(PENCE):
        raise ValueError("Amount must be in pence")
    return amount.quantize(PENCE)


def money_str(value: Decimal) -> str:
    return f"{Decimal(value).quantize(PENCE):.2f}"
