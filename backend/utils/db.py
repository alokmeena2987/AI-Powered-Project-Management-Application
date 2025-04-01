import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    """Create a database connection"""
    try:
        conn = psycopg2.connect(
            os.getenv('DATABASE_URL'),
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"Error connecting to the database: {e}")
        raise e

def execute_query(query, params=None, fetch=True):
    """Execute a database query and return results"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            if fetch:
                result = cur.fetchall()
            else:
                result = None
            conn.commit()
            return result
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def execute_many(query, params_list):
    """Execute multiple queries with different parameters"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.executemany(query, params_list)
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close() 