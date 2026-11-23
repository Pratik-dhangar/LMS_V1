"""Dependency-free checks of account preservation; no real database is contacted."""

import os
from pathlib import Path
import runpy
import sys
import types
import unittest
from unittest.mock import AsyncMock, Mock, patch


class Column:
    def __eq__(self, value):
        return value


class FakeUser:
    email = Column()
    role = Column()

    def __init__(self, **fields):
        self.__dict__.update(fields)


class BootstrapTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db = Mock()
        self.db.scalar = AsyncMock(return_value=None)
        self.db.scalars = AsyncMock(return_value=Mock(all=lambda: []))
        self.db.commit = AsyncMock()
        context = Mock(__aenter__=AsyncMock(return_value=self.db), __aexit__=AsyncMock(return_value=False))
        self.engine = Mock(dispose=AsyncMock())
        modules = {name: types.ModuleType(name) for name in (
            'sqlalchemy', 'app', 'app.models', 'app.core', 'app.core.security',
            'app.db', 'app.db.session', 'app.models.user_model',
        )}
        modules['app'].models = modules['app.models']
        query = Mock()
        query.where.return_value = query
        modules['sqlalchemy'].select = lambda model: query
        security = modules['app.core.security']
        security.encrypt_passcode = lambda value: 'encrypted:' + value
        security.hash_password = lambda value: 'hash:' + value
        security.verify_password = lambda value, stored: stored == 'hash:' + value
        modules['app.db.session'].AsyncSessionLocal = lambda: context
        modules['app.db.session'].engine = self.engine
        modules['app.models.user_model'].User = FakeUser
        modules['app.models.user_model'].UserRole = types.SimpleNamespace(ADMIN='ADMIN')
        self.module_patch = patch.dict(sys.modules, modules)
        self.module_patch.start()
        self.env_patch = patch.dict(os.environ, {
            'LOCAL_ADMIN_EMAIL': 'local@example.test', 'LOCAL_ADMIN_PASSCODE': '123456',
        })
        self.env_patch.start()
        self.addCleanup(self.module_patch.stop)
        self.addCleanup(self.env_patch.stop)
        self.bootstrap = runpy.run_path(str(Path(__file__).with_name('bootstrap.py')))

    async def test_creates_encrypted_and_hashed_admin(self):
        await self.bootstrap['run']()
        user = self.db.add.call_args.args[0]
        self.assertEqual(user.passcode, 'encrypted:123456')
        self.assertEqual(user.passcode_hash, 'hash:123456')
        self.assertEqual(user.role, 'ADMIN')
        self.db.commit.assert_awaited_once()
        self.engine.dispose.assert_awaited_once()

    async def test_rerun_preserves_existing_admin(self):
        self.db.scalar.return_value = FakeUser(role='ADMIN', passcode_hash='hash:123456')
        await self.bootstrap['run']()
        self.db.add.assert_not_called()
        self.db.commit.assert_not_awaited()

    async def test_mismatched_credentials_do_not_replace_user(self):
        self.db.scalar.return_value = FakeUser(role='ADMIN', passcode_hash='hash:999999')
        with self.assertRaisesRegex(RuntimeError, 'No account was changed'):
            await self.bootstrap['run']()
        self.db.add.assert_not_called()
        self.db.commit.assert_not_awaited()
        self.engine.dispose.assert_awaited_once()

    async def test_duplicate_admin_passcode_is_rejected(self):
        self.db.scalars.return_value = Mock(all=lambda: [FakeUser(passcode_hash='hash:123456')])
        with self.assertRaisesRegex(RuntimeError, 'another admin'):
            await self.bootstrap['run']()
        self.db.add.assert_not_called()
        self.db.commit.assert_not_awaited()

    async def test_invalid_passcode_is_rejected_before_database_access(self):
        os.environ['LOCAL_ADMIN_PASSCODE'] = '123'
        with self.assertRaisesRegex(RuntimeError, 'six ASCII digits'):
            await self.bootstrap['run']()
        self.db.scalar.assert_not_awaited()


if __name__ == '__main__':
    unittest.main()
