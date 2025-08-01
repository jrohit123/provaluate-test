import psycopg2
from psycopg2.extras import RealDictCursor, Json
import json
import uuid
from datetime import datetime
import logging
from config import Config

# Configure logging
logger = logging.getLogger(__name__)

class CriteriaManager:
    def __init__(self):
        self.db_config = Config.get_db_config()

    def get_db_connection(self):
        """Get database connection"""
        try:
            logger.info(f"Attempting database connection for criteria manager...")
            conn = psycopg2.connect(**self.db_config)
            logger.info("Database connection successful!")
            return conn
        except psycopg2.OperationalError as e:
            logger.error(f"Database operational error: {e}")
            return None
        except psycopg2.Error as e:
            logger.error(f"Database error: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected database connection error: {e}")
            return None

    def create_criteria(self, criteria_name, parameter=None, weightage=None, calc_note=None, 
                       created_by=None, company_id=None, grid=None):
        """Create a new criteria entry"""
        logger.info(f"Creating criteria: {criteria_name}")
        
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            insert_query = """
                INSERT INTO public.criteria (
                    criteria_name, parameter, weightage, calc_note, 
                    created_by, company_id, grid
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING criteria_id, created_at
            """
            
            cur.execute(insert_query, (
                criteria_name,
                parameter,
                weightage,
                calc_note,
                created_by,
                company_id,
                Json(grid) if grid else None
            ))
            
            result = cur.fetchone()
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"Successfully created criteria with ID: {result['criteria_id']}")
            return {
                'criteria_id': result['criteria_id'],
                'criteria_name': criteria_name,
                'created_at': result['created_at']
            }
            
        except psycopg2.Error as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"PostgreSQL error during criteria creation: {e}")
            raise Exception(f"Failed to create criteria: {e}")
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Unexpected error during criteria creation: {e}")
            raise Exception(f"Failed to create criteria: {e}")

    def get_criteria_by_company(self, company_id):
        """Get all criteria for a specific company"""
        logger.info(f"Getting criteria for company: {company_id}")
        
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT criteria_id, criteria_name, parameter, weightage, 
                       calc_note, created_at, updated_at, created_by, 
                       company_id, grid
                FROM public.criteria 
                WHERE company_id = %s
                ORDER BY created_at DESC
            """
            
            cur.execute(query, (company_id,))
            results = cur.fetchall()
            
            cur.close()
            conn.close()
            
            logger.info(f"Found {len(results)} criteria for company {company_id}")
            return [dict(row) for row in results]
            
        except psycopg2.Error as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"PostgreSQL error during criteria retrieval: {e}")
            raise Exception(f"Failed to retrieve criteria: {e}")
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Unexpected error during criteria retrieval: {e}")
            raise Exception(f"Failed to retrieve criteria: {e}")

    def get_criteria_by_id(self, criteria_id):
        """Get a specific criteria by ID"""
        logger.info(f"Getting criteria by ID: {criteria_id}")
        
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT criteria_id, criteria_name, parameter, weightage, 
                       calc_note, created_at, updated_at, created_by, 
                       company_id, grid
                FROM public.criteria 
                WHERE criteria_id = %s
            """
            
            cur.execute(query, (criteria_id,))
            result = cur.fetchone()
            
            cur.close()
            conn.close()
            
            if result:
                logger.info(f"Found criteria: {result['criteria_name']}")
                return dict(result)
            else:
                logger.warning(f"Criteria not found: {criteria_id}")
                return None
            
        except psycopg2.Error as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"PostgreSQL error during criteria retrieval: {e}")
            raise Exception(f"Failed to retrieve criteria: {e}")
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Unexpected error during criteria retrieval: {e}")
            raise Exception(f"Failed to retrieve criteria: {e}")

    def update_criteria(self, criteria_id, criteria_name=None, parameter=None, 
                       weightage=None, calc_note=None, grid=None):
        """Update an existing criteria"""
        logger.info(f"Updating criteria: {criteria_id}")
        
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Build dynamic update query
            update_fields = []
            params = []
            
            if criteria_name is not None:
                update_fields.append("criteria_name = %s")
                params.append(criteria_name)
            
            if parameter is not None:
                update_fields.append("parameter = %s")
                params.append(parameter)
            
            if weightage is not None:
                update_fields.append("weightage = %s")
                params.append(weightage)
            
            if calc_note is not None:
                update_fields.append("calc_note = %s")
                params.append(calc_note)
            
            if grid is not None:
                update_fields.append("grid = %s")
                params.append(Json(grid))
            
            if not update_fields:
                raise Exception("No fields to update")
            
            update_fields.append("updated_at = now()")
            params.append(criteria_id)
            
            query = f"""
                UPDATE public.criteria 
                SET {', '.join(update_fields)}
                WHERE criteria_id = %s
                RETURNING criteria_id, criteria_name, updated_at
            """
            
            cur.execute(query, params)
            result = cur.fetchone()
            
            if not result:
                raise Exception(f"Criteria not found: {criteria_id}")
            
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"Successfully updated criteria: {result['criteria_name']}")
            return {
                'criteria_id': result['criteria_id'],
                'criteria_name': result['criteria_name'],
                'updated_at': result['updated_at']
            }
            
        except psycopg2.Error as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"PostgreSQL error during criteria update: {e}")
            raise Exception(f"Failed to update criteria: {e}")
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Unexpected error during criteria update: {e}")
            raise Exception(f"Failed to update criteria: {e}")

    def delete_criteria(self, criteria_id):
        """Delete a criteria entry"""
        logger.info(f"Deleting criteria: {criteria_id}")
        
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # First check if criteria exists
            check_query = """
                SELECT criteria_name FROM public.criteria 
                WHERE criteria_id = %s
            """
            cur.execute(check_query, (criteria_id,))
            result = cur.fetchone()
            
            if not result:
                raise Exception(f"Criteria not found: {criteria_id}")
            
            # Delete the criteria
            delete_query = """
                DELETE FROM public.criteria 
                WHERE criteria_id = %s
                RETURNING criteria_name
            """
            
            cur.execute(delete_query, (criteria_id,))
            deleted_result = cur.fetchone()
            
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"Successfully deleted criteria: {deleted_result['criteria_name']}")
            return {
                'criteria_id': criteria_id,
                'criteria_name': deleted_result['criteria_name'],
                'deleted_at': datetime.now()
            }
            
        except psycopg2.Error as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"PostgreSQL error during criteria deletion: {e}")
            raise Exception(f"Failed to delete criteria: {e}")
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Unexpected error during criteria deletion: {e}")
            raise Exception(f"Failed to delete criteria: {e}")

    def get_all_criteria(self, limit=100, offset=0):
        """Get all criteria with pagination"""
        logger.info(f"Getting all criteria (limit: {limit}, offset: {offset})")
        
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT criteria_id, criteria_name, parameter, weightage, 
                       calc_note, created_at, updated_at, created_by, 
                       company_id, grid
                FROM public.criteria 
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """
            
            cur.execute(query, (limit, offset))
            results = cur.fetchall()
            
            cur.close()
            conn.close()
            
            logger.info(f"Found {len(results)} criteria")
            return [dict(row) for row in results]
            
        except psycopg2.Error as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"PostgreSQL error during criteria retrieval: {e}")
            raise Exception(f"Failed to retrieve criteria: {e}")
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Unexpected error during criteria retrieval: {e}")
            raise Exception(f"Failed to retrieve criteria: {e}")

    def search_criteria(self, search_term, company_id=None, limit=50):
        """Search criteria by name or parameter"""
        logger.info(f"Searching criteria with term: {search_term}")
        
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            if company_id:
                query = """
                    SELECT criteria_id, criteria_name, parameter, weightage, 
                           calc_note, created_at, updated_at, created_by, 
                           company_id, grid
                    FROM public.criteria 
                    WHERE (criteria_name ILIKE %s OR parameter ILIKE %s)
                    AND company_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """
                cur.execute(query, (f'%{search_term}%', f'%{search_term}%', company_id, limit))
            else:
                query = """
                    SELECT criteria_id, criteria_name, parameter, weightage, 
                           calc_note, created_at, updated_at, created_by, 
                           company_id, grid
                    FROM public.criteria 
                    WHERE criteria_name ILIKE %s OR parameter ILIKE %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """
                cur.execute(query, (f'%{search_term}%', f'%{search_term}%', limit))
            
            results = cur.fetchall()
            
            cur.close()
            conn.close()
            
            logger.info(f"Found {len(results)} matching criteria")
            return [dict(row) for row in results]
            
        except psycopg2.Error as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"PostgreSQL error during criteria search: {e}")
            raise Exception(f"Failed to search criteria: {e}")
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Unexpected error during criteria search: {e}")
            raise Exception(f"Failed to search criteria: {e}")

    def get_criteria_stats(self, company_id=None):
        """Get statistics about criteria"""
        logger.info(f"Getting criteria statistics for company: {company_id}")
        
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            if company_id:
                query = """
                    SELECT 
                        COUNT(*) as total_criteria,
                        COUNT(CASE WHEN weightage IS NOT NULL THEN 1 END) as criteria_with_weightage,
                        COUNT(CASE WHEN parameter IS NOT NULL THEN 1 END) as criteria_with_parameter,
                        AVG(weightage) as avg_weightage,
                        MIN(created_at) as oldest_criteria,
                        MAX(created_at) as newest_criteria
                    FROM public.criteria 
                    WHERE company_id = %s
                """
                cur.execute(query, (company_id,))
            else:
                query = """
                    SELECT 
                        COUNT(*) as total_criteria,
                        COUNT(CASE WHEN weightage IS NOT NULL THEN 1 END) as criteria_with_weightage,
                        COUNT(CASE WHEN parameter IS NOT NULL THEN 1 END) as criteria_with_parameter,
                        AVG(weightage) as avg_weightage,
                        MIN(created_at) as oldest_criteria,
                        MAX(created_at) as newest_criteria
                    FROM public.criteria
                """
                cur.execute(query)
            
            result = cur.fetchone()
            
            cur.close()
            conn.close()
            
            logger.info(f"Retrieved criteria statistics")
            return dict(result)
            
        except psycopg2.Error as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"PostgreSQL error during criteria stats retrieval: {e}")
            raise Exception(f"Failed to retrieve criteria statistics: {e}")
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Unexpected error during criteria stats retrieval: {e}")
            raise Exception(f"Failed to retrieve criteria statistics: {e}") 