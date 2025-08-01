from flask import Flask, request, jsonify
import logging
from criteria_manager import CriteriaManager
import uuid
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
criteria_manager = CriteriaManager()

@app.route('/criteria', methods=['POST'])
def create_criteria():
    """Create a new criteria"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Required fields
        criteria_name = data.get('criteria_name')
        if not criteria_name:
            return jsonify({'error': 'criteria_name is required'}), 400
        
        # Optional fields
        parameter = data.get('parameter')
        weightage = data.get('weightage')
        calc_note = data.get('calc_note')
        created_by = data.get('created_by')
        company_id = data.get('company_id')
        grid = data.get('grid')
        
        # Validate weightage if provided
        if weightage is not None:
            try:
                weightage = float(weightage)
                if weightage < 0 or weightage > 100:
                    return jsonify({'error': 'weightage must be between 0 and 100'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'weightage must be a valid number'}), 400
        
        # Create criteria
        result = criteria_manager.create_criteria(
            criteria_name=criteria_name,
            parameter=parameter,
            weightage=weightage,
            calc_note=calc_note,
            created_by=created_by,
            company_id=company_id,
            grid=grid
        )
        
        return jsonify({
            'status': 'success',
            'message': 'Criteria created successfully',
            'data': result
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating criteria: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/criteria/<criteria_id>', methods=['GET'])
def get_criteria(criteria_id):
    """Get a specific criteria by ID"""
    try:
        result = criteria_manager.get_criteria_by_id(criteria_id)
        
        if not result:
            return jsonify({
                'status': 'error',
                'message': 'Criteria not found'
            }), 404
        
        return jsonify({
            'status': 'success',
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Error getting criteria: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/criteria/<criteria_id>', methods=['PUT'])
def update_criteria(criteria_id):
    """Update an existing criteria"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Optional fields that can be updated
        criteria_name = data.get('criteria_name')
        parameter = data.get('parameter')
        weightage = data.get('weightage')
        calc_note = data.get('calc_note')
        grid = data.get('grid')
        
        # Validate weightage if provided
        if weightage is not None:
            try:
                weightage = float(weightage)
                if weightage < 0 or weightage > 100:
                    return jsonify({'error': 'weightage must be between 0 and 100'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'weightage must be a valid number'}), 400
        
        # Update criteria
        result = criteria_manager.update_criteria(
            criteria_id=criteria_id,
            criteria_name=criteria_name,
            parameter=parameter,
            weightage=weightage,
            calc_note=calc_note,
            grid=grid
        )
        
        return jsonify({
            'status': 'success',
            'message': 'Criteria updated successfully',
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Error updating criteria: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/criteria/<criteria_id>', methods=['DELETE'])
def delete_criteria(criteria_id):
    """Delete a criteria"""
    try:
        result = criteria_manager.delete_criteria(criteria_id)
        
        return jsonify({
            'status': 'success',
            'message': 'Criteria deleted successfully',
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Error deleting criteria: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/criteria', methods=['GET'])
def list_criteria():
    """List all criteria with optional filtering"""
    try:
        # Query parameters
        company_id = request.args.get('company_id')
        search = request.args.get('search')
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        
        # Validate pagination parameters
        if limit < 1 or limit > 1000:
            return jsonify({'error': 'limit must be between 1 and 1000'}), 400
        if offset < 0:
            return jsonify({'error': 'offset must be non-negative'}), 400
        
        if search:
            # Search criteria
            if company_id:
                results = criteria_manager.search_criteria(search, company_id, limit)
            else:
                results = criteria_manager.search_criteria(search, limit=limit)
        elif company_id:
            # Get criteria by company
            results = criteria_manager.get_criteria_by_company(company_id)
        else:
            # Get all criteria with pagination
            results = criteria_manager.get_all_criteria(limit, offset)
        
        return jsonify({
            'status': 'success',
            'data': results,
            'count': len(results)
        })
        
    except Exception as e:
        logger.error(f"Error listing criteria: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/criteria/stats', methods=['GET'])
def get_criteria_stats():
    """Get criteria statistics"""
    try:
        company_id = request.args.get('company_id')
        
        stats = criteria_manager.get_criteria_stats(company_id)
        
        return jsonify({
            'status': 'success',
            'data': stats
        })
        
    except Exception as e:
        logger.error(f"Error getting criteria stats: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/criteria/bulk', methods=['POST'])
def create_bulk_criteria():
    """Create multiple criteria at once"""
    try:
        data = request.get_json()
        
        if not data or not isinstance(data, list):
            return jsonify({'error': 'Data must be a list of criteria objects'}), 400
        
        results = []
        errors = []
        
        for i, criteria_data in enumerate(data):
            try:
                criteria_name = criteria_data.get('criteria_name')
                if not criteria_name:
                    errors.append({
                        'index': i,
                        'error': 'criteria_name is required'
                    })
                    continue
                
                # Validate weightage if provided
                weightage = criteria_data.get('weightage')
                if weightage is not None:
                    try:
                        weightage = float(weightage)
                        if weightage < 0 or weightage > 100:
                            errors.append({
                                'index': i,
                                'error': 'weightage must be between 0 and 100'
                            })
                            continue
                    except (ValueError, TypeError):
                        errors.append({
                            'index': i,
                            'error': 'weightage must be a valid number'
                        })
                        continue
                
                # Create criteria
                result = criteria_manager.create_criteria(
                    criteria_name=criteria_name,
                    parameter=criteria_data.get('parameter'),
                    weightage=weightage,
                    calc_note=criteria_data.get('calc_note'),
                    created_by=criteria_data.get('created_by'),
                    company_id=criteria_data.get('company_id'),
                    grid=criteria_data.get('grid')
                )
                
                results.append({
                    'index': i,
                    'status': 'success',
                    'data': result
                })
                
            except Exception as e:
                errors.append({
                    'index': i,
                    'error': str(e)
                })
        
        return jsonify({
            'status': 'success',
            'message': f'Created {len(results)} criteria, {len(errors)} failed',
            'data': {
                'successful': results,
                'errors': errors
            }
        }), 201 if results else 400
        
    except Exception as e:
        logger.error(f"Error creating bulk criteria: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/criteria/validate', methods=['POST'])
def validate_criteria():
    """Validate criteria data without creating it"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        errors = []
        warnings = []
        
        # Validate required fields
        criteria_name = data.get('criteria_name')
        if not criteria_name:
            errors.append('criteria_name is required')
        elif len(criteria_name.strip()) < 3:
            errors.append('criteria_name must be at least 3 characters long')
        
        # Validate weightage
        weightage = data.get('weightage')
        if weightage is not None:
            try:
                weightage = float(weightage)
                if weightage < 0 or weightage > 100:
                    errors.append('weightage must be between 0 and 100')
                elif weightage > 50:
                    warnings.append('weightage is quite high, consider if this is appropriate')
            except (ValueError, TypeError):
                errors.append('weightage must be a valid number')
        
        # Validate parameter
        parameter = data.get('parameter')
        if parameter and len(parameter.strip()) < 5:
            warnings.append('parameter seems quite short, consider providing more detail')
        
        # Validate grid structure if provided
        grid = data.get('grid')
        if grid and not isinstance(grid, dict):
            errors.append('grid must be a valid JSON object')
        
        return jsonify({
            'status': 'success',
            'data': {
                'is_valid': len(errors) == 0,
                'errors': errors,
                'warnings': warnings
            }
        })
        
    except Exception as e:
        logger.error(f"Error validating criteria: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        stats = criteria_manager.get_criteria_stats()
        return jsonify({
            'status': 'healthy',
            'service': 'criteria_api',
            'database': 'connected',
            'criteria_count': stats.get('total_criteria', 0)
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'service': 'criteria_api',
            'error': str(e)
        }), 500

@app.route('/')
def home():
    """Home endpoint"""
    return jsonify({
        'message': 'Criteria Management API is running',
        'endpoints': {
            'create_criteria': 'POST /criteria',
            'get_criteria': 'GET /criteria/<criteria_id>',
            'update_criteria': 'PUT /criteria/<criteria_id>',
            'delete_criteria': 'DELETE /criteria/<criteria_id>',
            'list_criteria': 'GET /criteria',
            'get_stats': 'GET /criteria/stats',
            'bulk_create': 'POST /criteria/bulk',
            'validate': 'POST /criteria/validate',
            'health': 'GET /health'
        }
    })

if __name__ == '__main__':
    print("Starting Criteria Management API on http://127.0.0.1:5003")
    app.run(debug=True, host='127.0.0.1', port=5003) 