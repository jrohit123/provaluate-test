import psycopg2
from psycopg2.extras import RealDictCursor, Json
import json
import uuid
from datetime import datetime
import logging
import requests
from config import Config

# Configure logging
logger = logging.getLogger(__name__)

class ScoringManager:
    def __init__(self):
        self.db_config = Config.get_db_config()
        self.ai_analyzer_url = 'http://localhost:5001/score_resume'  # AI scoring endpoint

    def get_db_connection(self):
        """Get database connection"""
        try:
            logger.info("Attempting database connection for scoring manager...")
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

    def get_resolved_jd_parameters(self, jd_id):
        """Get resolved JD parameters from the database"""
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # First, get the job description details
            cur.execute("""
                SELECT jd_id, title, jd_file, file_id
                FROM job_descriptions 
                WHERE jd_id = %s
            """, (jd_id,))
            
            jd_info = cur.fetchone()
            if not jd_info:
                logger.warning(f"Job description not found for JD: {jd_id}")
                return None
            
            # Try to find resolved JD parameters using multiple references
            cur.execute("""
                SELECT parameter, value, created_at
                FROM resolved_jd 
                WHERE referenced_jd = %s OR referenced_jd = %s OR referenced_jd = %s OR referenced_jd = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (jd_id, str(jd_id), jd_info['file_id'], jd_info['jd_file']))
            
            result = cur.fetchone()
            
            if result:
                logger.info(f"Found resolved JD parameters for JD: {jd_id}")
                return result['parameter']
            else:
                logger.warning(f"No resolved JD parameters found for JD: {jd_id}")
                # Create a fallback parameter structure based on JD title
                fallback_params = {
                    "experience_required": "3+ years",
                    "skills_required": ["Java", "Spring", "Hibernate"],
                    "education_required": "Bachelor's degree",
                    "location": "Remote/Hybrid",
                    "job_title": jd_info['title'] or "Software Engineer"
                }
                logger.info(f"Using fallback parameters for JD: {jd_id}")
                return fallback_params
                
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Error fetching resolved JD parameters: {e}")
            raise Exception(f"Failed to fetch resolved JD parameters: {e}")

    def get_criteria_grid(self, criteria_id):
        """Get criteria grid from the database"""
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT grid, criteria_name
                FROM criteria 
                WHERE criteria_id = %s
            """
            
            cur.execute(query, (criteria_id,))
            result = cur.fetchone()
            
            cur.close()
            conn.close()
            
            if result and result['grid']:
                logger.info(f"Found criteria grid for criteria: {result['criteria_name']}")
                return result['grid']
            else:
                logger.warning(f"No criteria grid found for criteria: {criteria_id}")
                return None
                
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Error fetching criteria grid: {e}")
            raise Exception(f"Failed to fetch criteria grid: {e}")

    def calculate_resume_score(self, analysis_id, criteria_id, jd_id, resume_filename, analysis_data):
        """Calculate resume score based on criteria grid and analysis data"""
        try:
            logger.info(f"Calculating score for resume: {resume_filename}")
            
            # Get resolved JD parameters
            jd_parameters = self.get_resolved_jd_parameters(jd_id)
            if not jd_parameters:
                logger.warning(f"No JD parameters found for JD: {jd_id}")
                return None
            
            # Get criteria grid
            criteria_grid = self.get_criteria_grid(criteria_id)
            if not criteria_grid:
                logger.warning(f"No criteria grid found for criteria: {criteria_id}")
                return None
            
            # Prepare payload for AI scoring
            payload = {
                'jd_parameters': jd_parameters,
                'candidate_details': analysis_data,
                'criteria_grid': criteria_grid,
                'resume_filename': resume_filename
            }
            
            # Call AI analyzer for scoring
            logger.info(f"Sending scoring request to AI analyzer")
            response = requests.post(self.ai_analyzer_url, json=payload, timeout=120)
            
            if response.status_code == 200:
                response_data = response.json()
                scoring_result = response_data.get('scoring_result', {})
                logger.info(f"AI scoring completed successfully")
                
                # Save scoring result to database
                score_id = self.save_scoring_result(
                    analysis_id, criteria_id, jd_id, resume_filename, scoring_result
                )
                
                return {
                    'score_id': score_id,
                    'scoring_result': scoring_result
                }
            else:
                logger.error(f"AI scoring failed: {response.text}")
                raise Exception(f"AI scoring failed: {response.text}")
                
        except Exception as e:
            logger.error(f"Error calculating resume score: {e}")
            raise Exception(f"Failed to calculate resume score: {e}")

    def save_scoring_result(self, analysis_id, criteria_id, jd_id, resume_filename, scoring_result):
        """Save scoring result to database"""
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Extract scoring data
            parameter_scores = scoring_result.get('parameter_scores', {})
            final_score = scoring_result.get('final_score', 0)
            recommendation = scoring_result.get('recommendation', 'Review further')
            consideration = scoring_result.get('consideration', '')
            
            # Log the extracted data
            logger.info(f"Saving scoring data: final_score={final_score}, recommendation={recommendation}")
            logger.info(f"Parameter scores: {len(parameter_scores)} parameters")
            
            insert_query = """
                INSERT INTO resume_scores (
                    analysis_id, criteria_id, jd_id, resume_filename,
                    parameter_scores, final_score, recommendation, consideration
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING score_id
            """
            
            cur.execute(insert_query, (
                analysis_id,
                criteria_id,
                jd_id,
                resume_filename,
                Json(parameter_scores),
                final_score,
                recommendation,
                consideration
            ))
            
            result = cur.fetchone()
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"Successfully saved scoring result with ID: {result['score_id']}")
            return result['score_id']
            
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Error saving scoring result: {e}")
            raise Exception(f"Failed to save scoring result: {e}")

    def get_resume_scores(self, jd_id=None, criteria_id=None, limit=50, offset=0):
        """Get resume scores with optional filtering"""
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Build dynamic query
            where_conditions = []
            params = []
            
            if jd_id:
                where_conditions.append("rs.jd_id = %s")
                params.append(jd_id)
            
            if criteria_id:
                where_conditions.append("rs.criteria_id = %s")
                params.append(criteria_id)
            
            where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
            
            query = f"""
                SELECT 
                    rs.score_id, rs.analysis_id, rs.criteria_id, rs.jd_id,
                    rs.resume_filename, rs.parameter_scores, rs.final_score,
                    rs.recommendation, rs.consideration, rs.created_at,
                    c.criteria_name, jd.title as jd_title
                FROM resume_scores rs
                LEFT JOIN criteria c ON rs.criteria_id = c.criteria_id
                LEFT JOIN job_descriptions jd ON rs.jd_id = jd.jd_id
                WHERE {where_clause}
                ORDER BY rs.created_at DESC
                LIMIT %s OFFSET %s
            """
            
            params.extend([limit, offset])
            cur.execute(query, params)
            results = cur.fetchall()
            
            cur.close()
            conn.close()
            
            logger.info(f"Found {len(results)} scoring results")
            return [dict(row) for row in results]
            
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Error fetching resume scores: {e}")
            raise Exception(f"Failed to fetch resume scores: {e}")

    def get_score_statistics(self, jd_id=None, criteria_id=None):
        """Get statistics about resume scores"""
        conn = self.get_db_connection()
        if not conn:
            raise Exception("Database connection failed")

        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Build dynamic query
            where_conditions = []
            params = []
            
            if jd_id:
                where_conditions.append("jd_id = %s")
                params.append(jd_id)
            
            if criteria_id:
                where_conditions.append("criteria_id = %s")
                params.append(criteria_id)
            
            where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
            
            query = f"""
                SELECT 
                    COUNT(*) as total_scores,
                    AVG(final_score) as avg_score,
                    MIN(final_score) as min_score,
                    MAX(final_score) as max_score,
                    COUNT(CASE WHEN recommendation = 'To be interviewed' THEN 1 END) as to_interview,
                    COUNT(CASE WHEN recommendation = 'Candidature rejected' THEN 1 END) as rejected,
                    COUNT(CASE WHEN recommendation = 'Review further' THEN 1 END) as review_further
                FROM resume_scores 
                WHERE {where_clause}
            """
            
            cur.execute(query, params)
            result = cur.fetchone()
            
            cur.close()
            conn.close()
            
            logger.info("Retrieved score statistics")
            return dict(result)
            
        except Exception as e:
            if conn:
                conn.rollback()
                cur.close()
                conn.close()
            logger.error(f"Error fetching score statistics: {e}")
            raise Exception(f"Failed to fetch score statistics: {e}") 