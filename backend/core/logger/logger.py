import json
import logging
import sys


class _JsonFormatter(logging.Formatter):
    """Machine-parseable JSON log formatter for production environments."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[1]:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


def _get_log_format() -> str:
    """Read log format from settings without circular import risk."""
    try:
        from config.config import settings
        return settings.log_format
    except Exception:
        return "text"


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)

    if _get_log_format() == "json":
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            fmt="%(asctime)s %(levelname)s %(name)s - %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        ))

    logger.addHandler(handler)
    logger.propagate = False
    return logger

