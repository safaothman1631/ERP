from pydantic import BaseModel, ConfigDict, Field


class WriteModelBase(BaseModel):
    # ignore unknown keys during rollout; type-check declared fields only
    model_config = ConfigDict(extra="ignore")

    schema_version: int = Field(default=1, ge=1)


def iso_currency(v: str = "IQD") -> str:
    return (v or "IQD").upper()[:3]
