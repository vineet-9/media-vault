class ApiError(Exception):
    """Raised anywhere in the API layer; converted to a JSON response
    by the errorhandler registered in create_app()."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
