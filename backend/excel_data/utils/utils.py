import threading
import pandas as pd
import numpy as np

# Thread local storage for current tenant
_thread_local = threading.local()

def set_current_tenant(tenant):
    """Set the current tenant in thread local storage"""
    _thread_local.tenant = tenant

def get_current_tenant():
    """Get the current tenant from thread local storage"""
    return getattr(_thread_local, 'tenant', None)

def clear_current_tenant():
    """Clear the current tenant from thread local storage"""
    if hasattr(_thread_local, 'tenant'):
        delattr(_thread_local, 'tenant')

def generate_employee_id(name: str, tenant_id: int, department: str = None) -> str:
    """
    Generate employee ID using format: First three letters-Department first two letters-Tenant id
    Example: Siddhant Marketing Analysis tenant_id 025 -> SID-MA-025
    
    In case of collision with same name, add postfix A, B, C
    Example: SID-MA-025-A, SID-MA-025-B, SID-MA-025-C
    """
    from ..models import EmployeeProfile
    import uuid
    
    if not name or str(name).strip() in ['', '0', 'nan', 'NaN', '-']:
        return str(uuid.uuid4())[:8]  # Random ID for empty names
    
    # Extract first three letters from name (uppercase)
    name_clean = ''.join(char for char in name.strip().upper() if char.isalpha())
    name_prefix = name_clean[:3].ljust(3, 'X')  # Pad with X if less than 3 letters
    
    # Extract first two letters from department (uppercase)
    if department and str(department).strip():
        dept_clean = ''.join(char for char in str(department).strip().upper() if char.isalpha())
        dept_prefix = dept_clean[:2].ljust(2, 'X')  # Pad with X if less than 2 letters
    else:
        dept_prefix = 'XX'  # Default if no department
    
    # Format tenant ID with leading zeros (3 digits)
    tenant_str = str(tenant_id).zfill(3)
    
    # Generate base employee ID
    base_id = f"{name_prefix}-{dept_prefix}-{tenant_str}"
    
    # Check for collisions and add postfix if needed
    collision_suffixes = ['', '-A', '-B', '-C', '-D', '-E', '-F', '-G', '-H', '-I', '-J']
    
    for suffix in collision_suffixes:
        candidate_id = f"{base_id}{suffix}"
        
        # Check if this ID already exists in the database for this tenant
        if not EmployeeProfile.objects.filter(tenant_id=tenant_id, employee_id=candidate_id).exists():
            return candidate_id
    
def generate_employee_id_bulk_optimized(employees_data: list, tenant_id: int) -> dict:
    """
    ULTRA-FAST bulk employee ID generation for large datasets
    
    Process all employees in memory first, then generate unique IDs in batch
    This avoids N database queries during ID generation
    
    Args:
        employees_data: List of dicts with 'name', 'department' keys
        tenant_id: Tenant ID
    
    Returns:
        Dict mapping array index to generated employee_id
    """
    from ..models import EmployeeProfile
    import uuid
    from collections import defaultdict
    
    # Get all existing employee IDs for this tenant in one query
    existing_ids = set(
        EmployeeProfile.objects.filter(tenant_id=tenant_id)
        .values_list('employee_id', flat=True)
    )
    
    # Track generated IDs to avoid duplicates within this batch
    generated_ids = set()
    id_collision_counters = defaultdict(int)  # Track collision counts per base ID
    result_mapping = {}
    
    for index, emp_data in enumerate(employees_data):
        name = emp_data.get('name', '')
        department = emp_data.get('department', '')
        
        # Handle empty names
        if not name or str(name).strip() in ['', '0', 'nan', 'NaN', '-']:
            unique_id = str(uuid.uuid4())[:8]
            result_mapping[index] = unique_id
            generated_ids.add(unique_id)
            continue
        
        # Extract first three letters from name (uppercase)
        name_clean = ''.join(char for char in name.strip().upper() if char.isalpha())
        name_prefix = name_clean[:3].ljust(3, 'X')
        
        # Extract first two letters from department (uppercase)
        if department and str(department).strip():
            dept_clean = ''.join(char for char in str(department).strip().upper() if char.isalpha())
            dept_prefix = dept_clean[:2].ljust(2, 'X')
        else:
            dept_prefix = 'XX'
        
        # Format tenant ID with leading zeros (3 digits)
        tenant_str = str(tenant_id).zfill(3)
        
        # Generate base employee ID
        base_id = f"{name_prefix}-{dept_prefix}-{tenant_str}"
        
        # Check for collisions in existing DB + already generated IDs
        collision_suffixes = ['', '-A', '-B', '-C', '-D', '-E', '-F', '-G', '-H', '-I', '-J']
        
        candidate_id = None
        for suffix in collision_suffixes:
            test_id = f"{base_id}{suffix}"
            
            # Check if this ID exists in DB or already generated in this batch
            if test_id not in existing_ids and test_id not in generated_ids:
                candidate_id = test_id
                break
        
        # If all suffixes exhausted, use UUID fallback
        if not candidate_id:
            candidate_id = str(uuid.uuid4())[:8]
        
        result_mapping[index] = candidate_id
        generated_ids.add(candidate_id)
    
    return result_mapping

def validate_excel_columns(df_columns, required_columns):
    """
    Validate that all required columns are present in the Excel file
    """
    missing_columns = set(required_columns) - set(df_columns)
    if missing_columns:
        return False, f"Missing required columns: {', '.join(missing_columns)}"
    return True, "All required columns present"

def clean_decimal_value(value):
    """
    Clean and convert value to decimal - optimized for pandas data
    """
    from decimal import Decimal
    try:
        # Handle pandas NaN values first
        if pd.isna(value) or pd.isnull(value):
            return Decimal('0.00')
        
        # Handle numpy NaN
        if isinstance(value, (np.floating, np.integer)) and np.isnan(value):
            return Decimal('0.00')
            
        # Handle common null/empty values
        if value in [None, '', 'NaN', 'nan', 'NULL', 'null']:
            return Decimal('0.00')
            
        # Remove any commas and convert to string
        clean_value = str(value).replace(',', '').strip()
        
        # Handle empty string after cleaning
        if not clean_value or clean_value.lower() in ['nan', 'none', 'null']:
            return Decimal('0.00')
            
        return Decimal(clean_value)
    except (ValueError, TypeError, OverflowError):
        return Decimal('0.00')

def clean_int_value(value):
    """
    Clean and convert value to integer - optimized for pandas data
    """
    try:
        # Handle pandas NaN values first
        if pd.isna(value) or pd.isnull(value):
            return 0
        
        # Handle numpy NaN
        if isinstance(value, (np.floating, np.integer)) and np.isnan(value):
            return 0
            
        # Handle common null/empty values
        if value in [None, '', 'NaN', 'nan', 'NULL', 'null']:
            return 0
            
        # Remove any commas and convert to string
        clean_value = str(value).replace(',', '').strip()
        
        # Handle empty string after cleaning
        if not clean_value or clean_value.lower() in ['nan', 'none', 'null']:
            return 0
            
        return int(float(clean_value))
    except (ValueError, TypeError, OverflowError):
        return 0

def is_valid_name(name):
    """
    Check if a name is valid (not empty, not just '-', not '0', etc.)
    Enhanced to handle pandas NaN values
    """
    # Handle pandas NaN first
    if pd.isna(name) or pd.isnull(name):
        return False
        
    # Handle numpy NaN
    if isinstance(name, (np.floating, np.integer)) and np.isnan(name):
        return False
    
    if not name:
        return False
        
    name_str = str(name).strip()
    invalid_names = ['', '-', '0', 'nan', 'NaN', 'None', 'none', 'NULL', 'null']
    
    # Check if name is just one of the invalid values
    if name_str.lower() in [x.lower() for x in invalid_names]:
        return False
        
    # Check if name is only made up of special characters
    if all(c in '- _.,#@!$%^&*()' for c in name_str):
        return False
        
    return True 