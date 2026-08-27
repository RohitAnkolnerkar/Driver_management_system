# Workspace Customization & Memory Guidelines

> [!IMPORTANT]
> **Persistent Context & Memory Instructions**
> Always consult [.agents/MEMORY.md](file:///c:/Users/Lenovo/OneDrive/Desktop/Driver_dashboard/.agents/MEMORY.md) and [.agents/CHAT_SUMMARY.md](file:///c:/Users/Lenovo/OneDrive/Desktop/Driver_dashboard/.agents/CHAT_SUMMARY.md) at the start of any conversation to retrieve project state, architectural overview, recent changes, and ongoing tasks.

## Agent Guidelines & Behaviors

1. **Memory Synchronization**:
   - Check `.agents/MEMORY.md` before performing redundant discovery commands or re-exploring project structure.
   - When completing significant feature work, update `.agents/MEMORY.md` and `.agents/CHAT_SUMMARY.md` with the new changes and status.

2. **Backend Standards (FastAPI / Python)**:
   - Framework: FastAPI, Pydantic v2 schemas, SQLAlchemy models.
   - Database: SQLite (`app.db`), managed with Alembic migrations under `alembic/versions/`.
   - Logging: Correlation ID tracking via `request_id_ctx` middleware in [app/main.py](file:///c:/Users/Lenovo/OneDrive/Desktop/Driver_dashboard/app/main.py) and [app/core/logging_config.py](file:///c:/Users/Lenovo/OneDrive/Desktop/Driver_dashboard/app/core/logging_config.py).
   - Tests: Pytest unit and integration tests under `tests/`.

3. **Frontend Standards (React / TypeScript)**:
   - Framework: React (TypeScript) via Vite.
   - Design Aesthetics: Modern dark themes, glassmorphism, dynamic micro-interactions, responsive flex/grid layouts.
   - Icons: `lucide-react`.
   - Map Integration: `leaflet` & `react-leaflet` with dark map tile layers.

4. **Workflow & Performance**:
   - Maintain concise responses and execute tasks efficiently to prevent context bloat.
   - Verify changes using automated tests (`pytest`) or API endpoint verification.
