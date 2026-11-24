"""Inventory the current session dependency graph; does not copy or alter app code.

Run from any directory:
    python scripts/extraction/map_live_session.py
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "hurshbintech-frontend"
SPECIFIERS = re.compile(r'''(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)[\'"]([^\'"]+)[\'"]''')


def source_text(path):
    text = path.read_text(encoding="utf-8-sig")
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"^\s*//.*$", "", text, flags=re.M)


def resolve(path):
    for candidate in [path, *[Path(str(path) + suffix) for suffix in (".js", ".jsx", ".json", ".css")], path / "index.js", path / "index.jsx"]:
        if candidate.is_file():
            return candidate.resolve()
    return None


def closure(roots):
    seen, packages, missing = set(), set(), set()
    pending = [FRONTEND / name for name in roots]
    while pending:
        path = pending.pop().resolve()
        if path in seen:
            continue
        seen.add(path)
        if path.suffix not in {".js", ".jsx", ".css"}:
            continue
        text = source_text(path)
        imports = SPECIFIERS.findall(text)
        if path.suffix == ".css":
            imports += re.findall(r'''url\([\'"]?([^\)\'"]+)''', text)
        for specifier in imports:
            if specifier.startswith("."):
                target = resolve(path.parent / specifier)
                if target:
                    pending.append(target)
                else:
                    missing.add(f"{path.relative_to(ROOT).as_posix()}: {specifier}")
            elif not specifier.startswith(("http", "data:", "/")):
                packages.add(specifier)
    return {"files": describe(seen), "external_imports": sorted(packages), "unresolved_relative_imports": sorted(missing)}


def describe(paths):
    return [{"path": p.relative_to(ROOT).as_posix(), "bytes": p.stat().st_size,
             "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(set(paths))]


def main():
    core = closure(["src/pages/trainer/TrainerSession.jsx", "src/pages/learner/LearnerSession.jsx"])
    chat = closure(["src/components/chat/ChatIconWidget.jsx", "src/context/chat/ChatContext.jsx"])
    assets = [p for folder in ("music", "reactions") for p in (FRONTEND / "public" / folder).rglob("*") if p.is_file()]
    shell = [FRONTEND / p for p in ("src/index.css", "src/App.css", "src/main.jsx", "src/App.jsx", "tailwind.config.js", "postcss.config.js", "package.json", "package-lock.json")]
    backend_names = [
        "app/api/endpoints/websocket.py", "app/crud/whiteboard_crud.py", "app/models/whiteboard_state_model.py",
        "app/api/endpoints/sessions.py", "app/crud/session_crud.py", "app/models/session_model.py", "app/schemas/session.py",
        "app/api/endpoints/learning_content.py", "app/crud/learning_content_crud.py", "app/models/learning_content_model.py", "app/schemas/learning_content.py",
        "app/api/endpoints/session_notes.py", "app/crud/session_notes_crud.py", "app/models/session_notes_model.py", "app/schemas/session_notes.py",
        "app/services/recording_merge_service.py", "app/services/recording_storage/factory.py", "app/services/recording_storage/local_storage.py", "app/services/recording_storage/base.py",
        "app/models/session_feedback_model.py", "app/utils/file_handler.py", "app/utils/s3_utils.py",
        "app/core/deps.py", "app/core/config.py", "app/db/session.py", "requirements.txt",
        "app/api/endpoints/Chat/chat.py", "app/services/Chat/chat_service.py", "app/services/Chat/chat_connection_manager.py", "app/models/Chat/chat_model.py",
    ]
    backend = [ROOT / "hurshbintech-backend" / name for name in backend_names]
    missing = [str(p.relative_to(ROOT)) for p in shell + backend if not p.is_file()]
    if missing or core["unresolved_relative_imports"] or chat["unresolved_relative_imports"]:
        raise RuntimeError(f"Unresolved inventory inputs: {missing + core['unresolved_relative_imports'] + chat['unresolved_relative_imports']}")
    lock = json.loads((FRONTEND / "package-lock.json").read_text(encoding="utf-8-sig"))["packages"]
    names = sorted(set(core["external_imports"] + chat["external_imports"] + ["react-dom", "vite", "@vitejs/plugin-react", "tailwindcss", "postcss", "autoprefixer"]))
    names = sorted(set("/".join(n.split("/")[:2]) if n.startswith("@") else n.split("/")[0] for n in names))
    versions = {n: lock.get("node_modules/" + n, {}).get("version") for n in names}
    protocols = {}
    for name in ("whiteboardService.js", "videoConferenceService.js"):
        text = source_text(FRONTEND / "src/api/services" / name)
        protocols[name] = sorted(set(re.findall(r'''case\s+[\'"]([^\'"]+)[\'"]''', text)))
    manifest = {
        "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "scope": "Static source inventory, not a ready-to-copy standalone application. See LIVE_SESSION_EXTRACTION_MAP.md for adaptations and runtime dependencies.",
        "limitations": ["Does not execute tools or prove two-browser feature parity.", "Computed/dynamic public paths require manual review.", "The chat closure includes LMS auth dependencies that must be replaced rather than copied blindly.", "Backend list identifies adaptation sources; it is not the full transitive Python import graph."],
        "session_core": core, "global_messaging": chat,
        "runtime_music_and_reactions": describe(assets),
        "shell_and_global_style_reference": describe(shell),
        "backend_adaptation_sources": describe(backend),
        "locked_frontend_versions": versions, "incoming_protocol_types": protocols,
    }
    output = ROOT / "docs/guides/LIVE_SESSION_EXTRACTION_MANIFEST.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Session core: {len(core['files'])} files; global messaging graph: {len(chat['files'])} files (overlaps core); runtime assets: {len(assets)}.")
    print(f"Wrote {output.relative_to(ROOT)}. No application code changed.")


if __name__ == "__main__":
    main()
