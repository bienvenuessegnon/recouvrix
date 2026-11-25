"""Utilitaire de sauvegarde à chaud et restauration sécurisée de la base Recouvrix."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = PROJECT_ROOT / "data" / "recouvrix.sqlite"
DEFAULT_BACKUP_DIR = PROJECT_ROOT / "data" / "backups"


def create_backup(db_path: Path, backup_dir: Path) -> Path:
    if not db_path.exists():
        raise FileNotFoundError(f"Base introuvable : {db_path}")
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest_path = backup_dir / f"recouvrix-backup-{stamp}.sqlite"

    src_conn = sqlite3.connect(str(db_path))
    dst_conn = sqlite3.connect(str(dest_path))
    try:
        src_conn.backup(dst_conn)
        check = dst_conn.execute("PRAGMA integrity_check;").fetchone()
        if not check or check[0] != "ok":
            raise RuntimeError(f"Échec du contrôle d'intégrité : {check}")
    finally:
        dst_conn.close()
        src_conn.close()
    return dest_path


def restore_backup(backup_file: Path, target_db: Path) -> None:
    if not backup_file.exists():
        raise FileNotFoundError(f"Sauvegarde introuvable : {backup_file}")

    src_conn = sqlite3.connect(str(backup_file))
    try:
        check = src_conn.execute("PRAGMA integrity_check;").fetchone()
        if not check or check[0] != "ok":
            raise RuntimeError(f"Le fichier de sauvegarde est corrompu : {check}")
    finally:
        src_conn.close()

    target_db.parent.mkdir(parents=True, exist_ok=True)
    # Sauvegarde de sécurité avant écrasement si une base existe déjà
    if target_db.exists():
        create_backup(target_db, target_db.parent / "backups")

    src_conn = sqlite3.connect(str(backup_file))
    dst_conn = sqlite3.connect(str(target_db))
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Sauvegarde et restauration Recouvrix")
    sub = parser.add_subparsers(dest="command", required=True)

    p_bak = sub.add_parser("backup", help="Créer une sauvegarde vérifiée")
    p_bak.add_argument("--db", type=Path, default=DEFAULT_DB)
    p_bak.add_argument("--out-dir", type=Path, default=DEFAULT_BACKUP_DIR)

    p_res = sub.add_parser("restore", help="Restaurer depuis une sauvegarde")
    p_res.add_argument("backup_file", type=Path)
    p_res.add_argument("--db", type=Path, default=DEFAULT_DB)

    args = parser.parse_args()
    if args.command == "backup":
        dest = create_backup(args.db, args.out_dir)
        print(f"Sauvegarde vérifiée créée : {dest}")
        return 0
    if args.command == "restore":
        restore_backup(args.backup_file, args.db)
        print(f"Base restaurée avec succès vers : {args.db}")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
