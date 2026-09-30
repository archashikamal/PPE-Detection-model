import aiosqlite
import json
import datetime
from config import DATABASE_PATH, DEFAULT_CONFIDENCE_THRESHOLD, DEFAULT_FRAME_SAMPLE_RATE

async def init_db():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS zones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                camera_id TEXT,
                polygon_points TEXT,
                required_ppe TEXT,
                created_at TEXT
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS violations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                class_name TEXT,
                confidence REAL,
                zone_id INTEGER,
                zone_name TEXT,
                bbox TEXT,
                thumbnail_path TEXT,
                frame_number INTEGER,
                video_filename TEXT
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        ''')
        await db.execute('''
            CREATE TABLE IF NOT EXISTS stats (
                date TEXT PRIMARY KEY,
                total_persons INTEGER,
                total_compliant INTEGER
            )
        ''')
        
        await db.execute('''\
            CREATE TABLE IF NOT EXISTS video_jobs (
                job_id TEXT PRIMARY KEY,
                filename TEXT,
                filepath TEXT,
                camera_id TEXT DEFAULT 'default',
                status TEXT DEFAULT 'pending',
                created_at TEXT,
                completed_at TEXT
            )
        ''')

        # Migration: older DBs created before camera_id scoping existed won't
        # have this column on video_jobs — add it if missing.
        try:
            await db.execute("ALTER TABLE video_jobs ADD COLUMN camera_id TEXT DEFAULT 'default'")
        except Exception:
            pass  # column already exists

        # Insert default settings if not exist
        await db.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 
                         ('confidence_threshold', str(DEFAULT_CONFIDENCE_THRESHOLD)))
        await db.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 
                         ('frame_sample_rate', str(DEFAULT_FRAME_SAMPLE_RATE)))
        await db.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 
                         ('per_class_thresholds', '{}'))
        
        await db.commit()

async def create_zone(name, camera_id, polygon_points, required_ppe):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        created_at = datetime.datetime.now().isoformat()
        cursor = await db.execute(
            'INSERT INTO zones (name, camera_id, polygon_points, required_ppe, created_at) VALUES (?, ?, ?, ?, ?)',
            (name, camera_id, json.dumps(polygon_points), json.dumps(required_ppe), created_at)
        )
        await db.commit()
        return cursor.lastrowid

async def get_zones(camera_id=None):
    """Fetch zones, optionally scoped to a single camera_id.
    Without a camera_id filter, every zone ever created would apply to every
    video/image regardless of which camera or scene it was drawn for —
    passing camera_id restricts checks to the zones actually relevant here.
    """
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        if camera_id:
            cursor = await db.execute('SELECT * FROM zones WHERE camera_id = ?', (camera_id,))
        else:
            cursor = await db.execute('SELECT * FROM zones')
        rows = await cursor.fetchall()

        zones = []
        for row in rows:
            zone = dict(row)
            zone['polygon_points'] = json.loads(zone['polygon_points'])
            zone['required_ppe'] = json.loads(zone['required_ppe'])
            zones.append(zone)
        return zones

async def get_camera_ids():
    """Distinct camera_id values across all zones, for populating a picker."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute('SELECT DISTINCT camera_id FROM zones WHERE camera_id IS NOT NULL ORDER BY camera_id')
        rows = await cursor.fetchall()
        return [r[0] for r in rows if r[0]]

async def get_zone(zone_id):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute('SELECT * FROM zones WHERE id = ?', (zone_id,))
        row = await cursor.fetchone()
        if row:
            zone = dict(row)
            zone['polygon_points'] = json.loads(zone['polygon_points'])
            zone['required_ppe'] = json.loads(zone['required_ppe'])
            return zone
        return None

async def update_zone(zone_id, name, camera_id, polygon_points, required_ppe):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            'UPDATE zones SET name=?, camera_id=?, polygon_points=?, required_ppe=? WHERE id=?',
            (name, camera_id, json.dumps(polygon_points), json.dumps(required_ppe), zone_id)
        )
        await db.commit()

async def delete_zone(zone_id):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute('DELETE FROM zones WHERE id=?', (zone_id,))
        await db.commit()

async def log_violation(timestamp, class_name, confidence, zone_id, zone_name, bbox, thumbnail_path, frame_number, video_filename):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute(
            'INSERT INTO violations (timestamp, class_name, confidence, zone_id, zone_name, bbox, thumbnail_path, frame_number, video_filename) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (timestamp, class_name, confidence, zone_id, zone_name, json.dumps(bbox), thumbnail_path, frame_number, video_filename)
        )
        await db.commit()
        return cursor.lastrowid

async def get_violation(violation_id):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute('SELECT * FROM violations WHERE id = ?', (violation_id,))
        row = await cursor.fetchone()
        if row:
            item = dict(row)
            item['bbox'] = json.loads(item['bbox']) if item['bbox'] else None
            return item
        return None

async def delete_violation(violation_id):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute('DELETE FROM violations WHERE id = ?', (violation_id,))
        await db.commit()
        return cursor.rowcount > 0

async def get_violations(page=1, page_size=20, date_from=None, date_to=None, class_name=None, zone_id=None):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        
        query = "SELECT * FROM violations WHERE 1=1"
        params = []
        
        if date_from:
            query += " AND timestamp >= ?"
            params.append(date_from)
        if date_to:
            query += " AND timestamp <= ?"
            params.append(date_to)
        if class_name:
            query += " AND class_name = ?"
            params.append(class_name)
        if zone_id:
            query += " AND zone_id = ?"
            params.append(zone_id)
            
        # Count total
        count_query = query.replace("SELECT *", "SELECT COUNT(*) as count")
        cursor = await db.execute(count_query, params)
        total_row = await cursor.fetchone()
        total = total_row['count']
        
        # Pagination
        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([page_size, (page - 1) * page_size])
        
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        
        items = []
        for row in rows:
            item = dict(row)
            item['bbox'] = json.loads(item['bbox']) if item['bbox'] else None
            items.append(item)
            
        return {"items": items, "total": total, "page": page, "page_size": page_size}

async def get_violations_for_export():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute('SELECT * FROM violations ORDER BY timestamp DESC')
        rows = await cursor.fetchall()
        items = []
        for row in rows:
            item = dict(row)
            item['bbox'] = json.loads(item['bbox']) if item['bbox'] else None
            items.append(item)
        return items

async def get_violation_stats_today():
    today = datetime.date.today().isoformat()
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT COUNT(*) as count FROM violations WHERE timestamp LIKE ?", (f"{today}%",))
        row = await cursor.fetchone()
        return row['count']

async def get_compliance_trend():
    today = datetime.date.today().isoformat()
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        # Hourly trend for today
        query = """
            SELECT strftime('%H:00', timestamp) as hour, COUNT(*) as violations
            FROM violations 
            WHERE timestamp LIKE ?
            GROUP BY hour
        """
        cursor = await db.execute(query, (f"{today}%",))
        rows = await cursor.fetchall()
        return [{"period": row['hour'], "rate": row['violations']} for row in rows] # Rate here is roughly inverse to violations

async def get_most_violated_zone_today():
    """The zone with the most violations today, computed over ALL of today's
    violations — not just a recent sample, which could both mis-rank zones
    and leak in violations from earlier days if today's volume is low."""
    today = datetime.date.today().isoformat()
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        query = """
            SELECT zone_name, COUNT(*) as count
            FROM violations
            WHERE timestamp LIKE ? AND zone_name IS NOT NULL AND zone_name != 'No Zone'
            GROUP BY zone_name
            ORDER BY count DESC
            LIMIT 1
        """
        cursor = await db.execute(query, (f"{today}%",))
        row = await cursor.fetchone()
        return row['zone_name'] if row else None

async def get_violations_by_class():
    today = datetime.date.today().isoformat()
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        query = """
            SELECT class_name, COUNT(*) as count
            FROM violations 
            WHERE timestamp LIKE ?
            GROUP BY class_name
        """
        cursor = await db.execute(query, (f"{today}%",))
        rows = await cursor.fetchall()
        return [{"class_name": row['class_name'], "count": row['count']} for row in rows]

async def update_stats(total_persons, compliant_persons):
    today = datetime.date.today().isoformat()
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute("SELECT * FROM stats WHERE date = ?", (today,))
        row = await cursor.fetchone()
        if row:
            await db.execute("UPDATE stats SET total_persons = total_persons + ?, total_compliant = total_compliant + ? WHERE date = ?", (total_persons, compliant_persons, today))
        else:
            await db.execute("INSERT INTO stats (date, total_persons, total_compliant) VALUES (?, ?, ?)", (today, total_persons, compliant_persons))
        await db.commit()

async def get_stats_today():
    today = datetime.date.today().isoformat()
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM stats WHERE date = ?", (today,))
        row = await cursor.fetchone()
        if row:
            return dict(row)
        return {"date": today, "total_persons": 0, "total_compliant": 0}

async def get_settings():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute('SELECT * FROM settings')
        rows = await cursor.fetchall()
        settings = {}
        for row in rows:
            key, value = row
            try:
                settings[key] = json.loads(value)
            except json.JSONDecodeError:
                if value.replace('.', '', 1).isdigit():
                    settings[key] = float(value) if '.' in value else int(value)
                else:
                    settings[key] = value
        return settings

async def update_settings(new_settings):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        for key, value in new_settings.items():
            str_val = json.dumps(value) if isinstance(value, (dict, list)) else str(value)
            await db.execute(
                'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=?',
                (key, str_val, str_val)
            )
        await db.commit()

# ── Video Job persistence ───────────────────────────────────────────────────

async def create_video_job(job_id: str, filename: str, filepath: str, camera_id: str = 'default'):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        created_at = datetime.datetime.now().isoformat()
        await db.execute(
            'INSERT OR REPLACE INTO video_jobs (job_id, filename, filepath, camera_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            (job_id, filename, filepath, camera_id, 'pending', created_at)
        )
        await db.commit()

async def update_video_job_status(job_id: str, status: str):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        completed_at = datetime.datetime.now().isoformat() if status in ('complete', 'error') else None
        await db.execute(
            'UPDATE video_jobs SET status=?, completed_at=? WHERE job_id=?',
            (status, completed_at, job_id)
        )
        await db.commit()

async def get_all_video_jobs():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute('SELECT * FROM video_jobs ORDER BY created_at DESC')
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

async def get_pending_video_jobs():
    """Returns jobs that were uploaded but never successfully processed (status = pending or processing)."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM video_jobs WHERE status IN ('pending', 'processing') ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

async def delete_video_job(job_id: str):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute('DELETE FROM video_jobs WHERE job_id=?', (job_id,))
        await db.commit()
