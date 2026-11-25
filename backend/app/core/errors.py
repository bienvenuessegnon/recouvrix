from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    def __init__(self, message: str, status_code: int = 400, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        payload: dict[str, object] = {"error": exc.message}
        if exc.code:
            payload["code"] = exc.code
        return JSONResponse(status_code=exc.status_code, content=payload)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "Une erreur est survenue lors du traitement de votre demande."
        return JSONResponse(status_code=exc.status_code, content={"error": detail})

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        # Traduit les erreurs de validation en message utilisateur clair, sans détails techniques
        first_msg = "Vérifiez les informations saisies avant de continuer."
        for err in exc.errors():
            custom_ctx = err.get("ctx", {}).get("error")
            if custom_ctx is not None:
                first_msg = str(custom_ctx)
                break
            err_msg = err.get("msg", "")
            if isinstance(err_msg, str) and err_msg.startswith("Value error, "):
                first_msg = err_msg.replace("Value error, ", "", 1)
                break
        return JSONResponse(status_code=400, content={"error": first_msg})

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, _exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"error": "Une erreur interne temporaire est survenue. Veuillez réessayer."},
        )
