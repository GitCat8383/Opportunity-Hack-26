import csv
import io
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from app.models.client import Client
from app.schemas.org_config import CustomFieldDefinition

CORE_EXPORT_COLUMNS = [
    ("First Name", "first_name"),
    ("Last Name", "last_name"),
    ("Date of Birth", "date_of_birth"),
    ("Phone", "phone"),
    ("Email", "email"),
    ("Address", "address"),
    ("Language", "language"),
    ("Gender", "gender"),
    ("Household Size", "household_size"),
    ("Status", "status"),
]

CORE_IMPORT_ALIASES = {
    "first_name": ["first_name", "First Name"],
    "last_name": ["last_name", "Last Name"],
    "name": ["name", "Name", "full_name", "Full Name"],
    "date_of_birth": ["date_of_birth", "Date of Birth"],
    "phone": ["phone", "Phone"],
    "email": ["email", "Email"],
    "address": ["address", "Address"],
    "language": ["language", "Language"],
    "gender": ["gender", "Gender"],
    "household_size": ["household_size", "Household Size"],
    "status": ["status", "Status"],
}

VALID_STATUSES = {"active", "inactive", "archived"}


@dataclass
class ParsedImportRow:
    row_number: int
    client: Client | None
    errors: list[str]
    row_data: dict[str, str]


def _get_first_present(row: dict[str, str], aliases: list[str]) -> str:
    for alias in aliases:
        value = row.get(alias)
        if value is not None and str(value).strip() != "":
            return str(value).strip()
    return ""


def _parse_name_fields(row: dict[str, str]) -> tuple[str, str]:
    first_name = _get_first_present(row, CORE_IMPORT_ALIASES["first_name"])
    last_name = _get_first_present(row, CORE_IMPORT_ALIASES["last_name"])

    if first_name and last_name:
        return first_name, last_name

    full_name = _get_first_present(row, CORE_IMPORT_ALIASES["name"])
    if full_name:
        parts = full_name.split()
        if len(parts) == 1:
            return parts[0], ""
        return parts[0], " ".join(parts[1:])

    return first_name, last_name


def _parse_date(value: str) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


def _parse_household_size(value: str) -> int | None:
    if not value:
        return None
    return int(value)


def _coerce_custom_value(
    field: CustomFieldDefinition,
    value: str,
) -> str | int | None:
    if value == "":
        return None
    if field.field_type == "number":
        return int(value)
    if field.field_type == "date":
        return date.fromisoformat(value).isoformat()
    if field.field_type == "select":
        if value not in field.options:
            raise ValueError(f"must be one of: {', '.join(field.options)}")
    return value


def parse_client_import_row(
    *,
    row_number: int,
    row: dict[str, str],
    org_id: UUID,
    created_by: UUID,
    extra_fields_schema: list[CustomFieldDefinition],
) -> ParsedImportRow:
    errors: list[str] = []
    first_name, last_name = _parse_name_fields(row)
    if not first_name:
        errors.append("First name is required")
    if not last_name:
        errors.append("Last name is required")

    date_of_birth_raw = _get_first_present(row, CORE_IMPORT_ALIASES["date_of_birth"])
    household_size_raw = _get_first_present(row, CORE_IMPORT_ALIASES["household_size"])
    status = _get_first_present(row, CORE_IMPORT_ALIASES["status"]).lower() or "active"
    language = _get_first_present(row, CORE_IMPORT_ALIASES["language"]) or "en"

    parsed_date_of_birth = None
    if date_of_birth_raw:
        try:
            parsed_date_of_birth = _parse_date(date_of_birth_raw)
        except ValueError:
            errors.append("Date of Birth must be YYYY-MM-DD")

    parsed_household_size = None
    if household_size_raw:
        try:
            parsed_household_size = _parse_household_size(household_size_raw)
        except ValueError:
            errors.append("Household Size must be a whole number")

    if status not in VALID_STATUSES:
        errors.append("Status must be active, inactive, or archived")

    extra_fields: dict[str, str | int | None] = {}
    known_headers = {
        alias
        for aliases in CORE_IMPORT_ALIASES.values()
        for alias in aliases
    }
    schema_headers = {field.key for field in extra_fields_schema} | {
        field.label for field in extra_fields_schema
    }

    for field in extra_fields_schema:
        raw_value = row.get(field.key, row.get(field.label, ""))
        raw_value = "" if raw_value is None else str(raw_value).strip()
        if field.required and raw_value == "":
            errors.append(f"{field.label} is required")
            continue
        try:
            coerced = _coerce_custom_value(field, raw_value)
        except ValueError as exc:
            errors.append(f"{field.label} {exc}")
            continue
        if coerced is not None:
            extra_fields[field.key] = coerced

    for key, value in row.items():
        if key in known_headers or key in schema_headers:
            continue
        if value is not None and str(value).strip() != "":
            extra_fields[key] = str(value).strip()

    if errors:
        return ParsedImportRow(
            row_number=row_number,
            client=None,
            errors=errors,
            row_data={key: "" if value is None else str(value) for key, value in row.items()},
        )

    client = Client(
        org_id=org_id,
        created_by=created_by,
        first_name=first_name,
        last_name=last_name,
        date_of_birth=parsed_date_of_birth,
        phone=_get_first_present(row, CORE_IMPORT_ALIASES["phone"]) or None,
        email=_get_first_present(row, CORE_IMPORT_ALIASES["email"]) or None,
        address=_get_first_present(row, CORE_IMPORT_ALIASES["address"]) or None,
        language=language,
        gender=_get_first_present(row, CORE_IMPORT_ALIASES["gender"]) or None,
        household_size=parsed_household_size,
        status=status,
        extra_fields=extra_fields,
    )
    return ParsedImportRow(
        row_number=row_number,
        client=client,
        errors=[],
        row_data={key: "" if value is None else str(value) for key, value in row.items()},
    )


def export_clients_to_csv(
    clients: list[Client],
    extra_fields_schema: list[CustomFieldDefinition],
) -> str:
    schema_keys = [field.key for field in extra_fields_schema]
    schema_headers = [field.label for field in extra_fields_schema]

    extra_keys_from_data = sorted(
        {
            key
            for client in clients
            for key in client.extra_fields.keys()
            if key not in schema_keys
        }
    )

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            header for header, _ in CORE_EXPORT_COLUMNS
        ]
        + schema_headers
        + extra_keys_from_data,
    )
    writer.writeheader()

    for client in clients:
        row = {
            header: getattr(client, field_name) if getattr(client, field_name) is not None else ""
            for header, field_name in CORE_EXPORT_COLUMNS
        }

        for field in extra_fields_schema:
            row[field.label] = client.extra_fields.get(field.key, "")

        for key in extra_keys_from_data:
            row[key] = client.extra_fields.get(key, "")

        writer.writerow(row)

    return output.getvalue()
