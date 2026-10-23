"""Conexão com o Firebird via firebird-driver."""
from contextlib import contextmanager
from typing import Iterator

from firebird.driver import Connection, connect, driver_config

from . import config

if config.FIREBIRD_CLIENT_LIB:
    driver_config.fb_client_library.value = config.FIREBIRD_CLIENT_LIB


def _dsn() -> str:
    return f"{config.FIREBIRD_HOST}/{config.FIREBIRD_PORT}:{config.FIREBIRD_DATABASE}"


def open_connection() -> Connection:
    return connect(_dsn(), user=config.FIREBIRD_USER, password=config.FIREBIRD_PASSWORD, charset="UTF8")


@contextmanager
def transaction() -> Iterator[Connection]:
    """Abre uma conexão e confirma (commit) ao sair; em erro, desfaz (rollback).

    Uma conexão por operação mantém o código simples. Para este volume de
    dados o custo é desprezível; em produção valeria um pool.
    """
    con = open_connection()
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()
