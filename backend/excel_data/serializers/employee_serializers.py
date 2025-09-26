"""
Serializers for employee-related models including profiles,
forms, and table views.
"""

from rest_framework import serializers
from ..models import EmployeeProfile, SalaryData

class EmployeeProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for employee profiles
    """
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = EmployeeProfile
        fields = [
            'id', 'first_name', 'last_name', 'full_name', 'email', 'employee_id', 
            'department', 'designation', 'date_of_joining', 'mobile_number', 
            'basic_salary', 'is_active', 'employment_type', 'location_branch',
            'shift_start_time', 'shift_end_time', 'date_of_birth', 'marital_status',
            'gender', 'nationality', 'address', 'city', 'state', 'tds_percentage',
            'ot_charge_per_hour', 'off_monday', 'off_tuesday', 'off_wednesday',
            'off_thursday', 'off_friday', 'off_saturday', 'off_sunday',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['employee_id', 'created_at', 'updated_at']
    
    def get_full_name(self, obj):
        return obj.full_name

class EmployeeProfileListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for employee list views
    """
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = EmployeeProfile
        fields = ['id', 'employee_id', 'first_name', 'last_name', 'full_name', 
                  'department', 'designation', 'mobile_number', 'email', 'is_active']
    
    def get_full_name(self, obj):
        return obj.full_name

class EmployeeFormSerializer(serializers.ModelSerializer):
    """
    Serializer for employee form submissions with mandatory field validation
    """
    # Calculate OT rate display value
    ot_calculation = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = EmployeeProfile
        fields = [
            'first_name', 'last_name', 'mobile_number', 'email', 'date_of_birth',
            'marital_status', 'gender', 'nationality', 'address', 'city', 'state',
            'department', 'designation', 'employment_type', 'date_of_joining',
            'location_branch', 'shift_start_time', 'shift_end_time', 
            'basic_salary', 'tds_percentage', 'ot_charge_per_hour', 'ot_calculation',
            'off_monday', 'off_tuesday', 'off_wednesday', 'off_thursday',
            'off_friday', 'off_saturday', 'off_sunday', 'is_active'
        ]
        
    def get_ot_calculation(self, obj):
        """Show OT calculation formula"""
        if obj.basic_salary:
            return f"{obj.basic_salary} ÷ 240 = {round(obj.basic_salary / 240, 2)}"
        return "Enter basic salary to calculate"
        
    def validate(self, data):
        """Custom validation for mandatory fields"""
        # Mandatory fields validation
        required_fields = ['first_name', 'last_name', 'shift_start_time', 'shift_end_time', 'basic_salary']
        
        for field in required_fields:
            if not data.get(field):
                raise serializers.ValidationError(f"{field.replace('_', ' ').title()} is required.")
        
        return data

class EmployeeTableSerializer(serializers.ModelSerializer):
    """
    Serializer for employee table view with calculated fields
    """
    employee_name = serializers.SerializerMethodField()
    latest_salary = serializers.SerializerMethodField()
    attendance_percentage = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeProfile
        fields = [
            'employee_id', 'employee_name', 'mobile_number', 'email',
            'department', 'designation', 'employment_type', 'location_branch',
            'basic_salary', 'ot_charge_per_hour', 'latest_salary', 'attendance_percentage'
        ]

    def get_employee_name(self, obj):
        return obj.full_name

    def get_latest_salary(self, obj):
        latest = SalaryData.objects.filter(employee_id=obj.employee_id).order_by('-year', '-month').first()
        return float(latest.nett_payable) if latest else 0

    def get_attendance_percentage(self, obj):
        # Calculate from latest salary data
        latest = SalaryData.objects.filter(employee_id=obj.employee_id).order_by('-year', '-month').first()
        if latest and latest.days > 0:
            return round((latest.days / (latest.days + latest.absent)) * 100, 1)
        return 0