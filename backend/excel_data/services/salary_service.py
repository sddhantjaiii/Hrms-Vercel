"""
Autonomous Salary Calculator Service

This service handles salary calculations for both uploaded data and frontend-tracked data,
providing a unified calculation engine with admin controls for advance deductions.
"""

from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
from ..models import (
    EmployeeProfile, Attendance, SalaryData, AdvanceLedger, PayrollPeriod, CalculatedSalary, SalaryAdjustment, DataSource,
    MonthlyAttendanceSummary, DailyAttendance,
)
import logging

logger = logging.getLogger(__name__)

class SalaryCalculationService:
    """
    Service class for autonomous salary calculations
    """
    
    @staticmethod
    def get_or_create_payroll_period(tenant, year: int, month: str, data_source: str = DataSource.FRONTEND):
        """Get or create a payroll period"""
        # Calculate working days based on the month and typical off days
        working_days = SalaryCalculationService._calculate_working_days_for_month(year, month)
        
        period, created = PayrollPeriod.objects.get_or_create(
            tenant=tenant,
            year=year,
            month=month,
            defaults={
                'data_source': data_source,
                'working_days_in_month': working_days,  # Dynamic calculation
                'tds_rate': Decimal('5.00')   # Default 5% TDS
            }
        )
        return period
    
    @staticmethod
    def _calculate_working_days_for_month(year: int, month: str) -> int:
        """
        Calculate working days for a given month considering standard off days
        Default: 0 off days means all days are working days except weekends
        """
        import calendar
        from datetime import date, timedelta
        
        month_num = SalaryCalculationService._get_month_number(month)
        
        # Get total days in month
        total_days = calendar.monthrange(year, month_num)[1]
        
        # Count weekends (Saturdays and Sundays by default)
        working_days = 0
        for day in range(1, total_days + 1):
            current_date = date(year, month_num, day)
            # Monday = 0, Sunday = 6
            if current_date.weekday() < 6:  # Monday to Saturday (0-5)
                working_days += 1
        
        return working_days
    
    @staticmethod
    def _calculate_employee_working_days(employee: 'EmployeeProfile', year: int, month: str) -> int:
        """
        Calculate working days for a specific employee considering their off days and joining date
        """
        import calendar
        from datetime import date, timedelta
        
        month_num = SalaryCalculationService._get_month_number(month)
        total_days = calendar.monthrange(year, month_num)[1]
        
        # Determine the start date for calculation
        month_start = date(year, month_num, 1)
        month_end = date(year, month_num, total_days)
        
        # If employee has a joining date, start from the joining date if it's within this month
        start_date = month_start
        if employee.date_of_joining:
            if employee.date_of_joining > month_end:
                # Employee hasn't joined yet in this month
                return 0
            elif employee.date_of_joining > month_start:
                # Employee joined mid-month
                start_date = employee.date_of_joining
        
        # Get employee's off days
        off_days = []
        if employee.off_monday: off_days.append(0)  # Monday
        if employee.off_tuesday: off_days.append(1)  # Tuesday
        if employee.off_wednesday: off_days.append(2)  # Wednesday
        if employee.off_thursday: off_days.append(3)  # Thursday
        if employee.off_friday: off_days.append(4)  # Friday
        if employee.off_saturday: off_days.append(5)  # Saturday
        if employee.off_sunday: off_days.append(6)  # Sunday
        
        # Count working days for this employee from start_date to month_end
        working_days = 0
        current_date = start_date
        while current_date <= month_end:
            # Check if this day is not in employee's off days
            if current_date.weekday() not in off_days:
                working_days += 1
            current_date = current_date + timedelta(days=1)
        
        return working_days
    
    @staticmethod
    def calculate_salary_for_period(tenant, year: int, month: str, force_recalculate: bool = False):
        """
        Calculate salaries for all active employees for a given period
        
        Args:
            tenant: Tenant instance
            year: Year (e.g., 2025)
            month: Month name (e.g., "JUNE")
            force_recalculate: Whether to recalculate existing records
        
        Returns:
            dict: Summary of calculation results
        """
        with transaction.atomic():
            # Determine data source based on existing data
            data_source = SalaryCalculationService._determine_data_source(tenant, year, month)
            
            # Get or create payroll period
            payroll_period = SalaryCalculationService.get_or_create_payroll_period(
                tenant, year, month, data_source
            )
            
            if payroll_period.is_locked and not force_recalculate:
                return {
                    'status': 'locked',
                    'message': f'Payroll for {month} {year} is locked',
                    'period_id': payroll_period.id
                }
            
            # Get all active employees
            active_employees = EmployeeProfile.objects.filter(
                tenant=tenant,
                is_active=True
            )
            
            results = {
                'calculated': 0,
                'updated': 0,
                'errors': [],
                'period_id': payroll_period.id,
                'data_source': data_source
            }
            
            for employee in active_employees:
                try:
                    calculated_salary = SalaryCalculationService._calculate_employee_salary(
                        payroll_period, employee, force_recalculate
                    )
                    
                    if calculated_salary:
                        if calculated_salary._state.adding:
                            results['calculated'] += 1
                        else:
                            results['updated'] += 1
                except Exception as e:
                    logger.error(f"Error calculating salary for {employee.employee_id}: {str(e)}")
                    results['errors'].append(f"{employee.employee_id}: {str(e)}")
            
            return results
    
    @staticmethod
    def _determine_data_source(tenant, year: int, month: str) -> str:
        """Determine if period should use uploaded data or frontend calculations"""
        
        # Check if we have uploaded salary data for this period
        has_uploaded_salary = SalaryData.objects.filter(
            tenant=tenant,
            year=year,
            month=month
        ).exists()
        
        # Check if we have frontend attendance data
        month_start = date(year, SalaryCalculationService._get_month_number(month), 1)
        has_frontend_attendance = Attendance.objects.filter(
            tenant=tenant,
            date__year=year,
            date__month=month_start.month,
            calendar_days=1,  # Indicates daily tracking
            total_working_days=1
        ).exists()
        
        if has_uploaded_salary and has_frontend_attendance:
            return DataSource.HYBRID
        elif has_uploaded_salary:
            return DataSource.UPLOADED
        else:
            return DataSource.FRONTEND
    
    @staticmethod
    def _calculate_employee_salary(payroll_period: PayrollPeriod, employee: EmployeeProfile, force_recalculate: bool = False):
        """Calculate salary for a specific employee"""
        
        # Ensure employee has an employee_id
        if not employee.employee_id:
            logger.error(f"Employee {employee.full_name} (ID: {employee.id}) has no employee_id")
            return None
        
        # Check if calculation already exists
        existing = CalculatedSalary.objects.filter(
            tenant=employee.tenant,
            payroll_period=payroll_period,
            employee_id=employee.employee_id
        ).first()
        
        if existing and not force_recalculate:
            return existing
        
        # Get attendance data (with force calculation support)
        attendance_data = SalaryCalculationService._get_attendance_data(
            employee, payroll_period.year, payroll_period.month, force_recalculate
        )
        
        # Get advance balance
        advance_balance = SalaryCalculationService._get_advance_balance(employee.employee_id)
        
        # Calculate per-hour and per-minute rates
        basic_salary = employee.basic_salary or Decimal('0')
        # Use employee-specific working days instead of period working days
        working_days = SalaryCalculationService._calculate_employee_working_days(
            employee, payroll_period.year, payroll_period.month
        )
        hours_per_day = 8  # Standard working hours
        minutes_per_day = hours_per_day * 60
        
        basic_salary_per_hour = basic_salary / (working_days * hours_per_day) if working_days > 0 else Decimal('0')
        basic_salary_per_minute = basic_salary / (working_days * minutes_per_day) if working_days > 0 else Decimal('0')
        
        # Use employee's OT rate if available, otherwise calculate from basic salary
        if employee.ot_charge_per_hour:
            ot_rate_per_hour = employee.ot_charge_per_hour
        else:
            # Calculate OT rate as Basic Salary ÷ 240 hours (standard formula)
            ot_rate_per_hour = basic_salary / Decimal('240') if basic_salary > 0 else Decimal('0')
        
        # Use employee's TDS percentage if available, otherwise use period default
        employee_tds_rate = employee.tds_percentage if employee.tds_percentage is not None else payroll_period.tds_rate
        
        # Prepare salary calculation data
        salary_data = {
            'payroll_period': payroll_period,
            'employee_id': employee.employee_id,
            'employee_name': f"{employee.first_name} {employee.last_name}",
            'department': employee.department or 'General',
            'basic_salary': basic_salary,
            'basic_salary_per_hour': basic_salary_per_hour,
            'basic_salary_per_minute': basic_salary_per_minute,
            'employee_ot_rate': ot_rate_per_hour,
            'employee_tds_rate': employee_tds_rate,
            'total_working_days': attendance_data['total_working_days'],
            'present_days': attendance_data['present_days'],
            'absent_days': attendance_data['absent_days'],
            'ot_hours': attendance_data['ot_hours'],
            'late_minutes': attendance_data['late_minutes'],
            'total_advance_balance': advance_balance,
            'data_source': payroll_period.data_source,
        }
        
        # Create or update calculated salary
        if existing:
            for key, value in salary_data.items():
                setattr(existing, key, value)
            existing.save()
            return existing
        else:
            return CalculatedSalary.objects.create(tenant=employee.tenant, **salary_data)
    
    @staticmethod
    def _get_attendance_data(employee: EmployeeProfile, year: int, month: str, force_calculate_partial: bool = False) -> dict:
        """
        Get attendance data from either uploaded or frontend sources
        Enhanced to support force calculation for partial months
        """
        from datetime import date, datetime
        
        month_num = SalaryCalculationService._get_month_number(month)
        
        # First, try to get from uploaded SalaryData
        salary_record = SalaryData.objects.filter(
            tenant=employee.tenant,
            employee_id=employee.employee_id,
            year=year,
            month=month
        ).first()
        
        if salary_record and not force_calculate_partial:
            # Use uploaded data for full month calculation
            return {
                'total_working_days': salary_record.days + salary_record.absent,
                'present_days': Decimal(str(salary_record.days)),
                'absent_days': Decimal(str(salary_record.absent)),
                'ot_hours': salary_record.ot,
                'late_minutes': salary_record.late,
            }
        
        # Next try the pre-aggregated MonthlyAttendanceSummary (fast path)
        summary = MonthlyAttendanceSummary.objects.filter(
            tenant=employee.tenant,
            employee_id=employee.employee_id,
            year=year,
            month=month_num,
        ).first()

        if summary and not force_calculate_partial:
            employee_working_days = SalaryCalculationService._calculate_employee_working_days(
                employee, year, month
            )

            # Only count explicitly logged absences, not assumed ones based on missing attendance
            # If an employee has some attendance records, absent_days should only count explicit ABSENT entries
            # For employees with no records at all, both present and absent should be 0
            
            # Get count of explicit ABSENT entries for this employee/month
            explicit_absent_count = DailyAttendance.objects.filter(
                tenant=employee.tenant,
                employee_id=employee.employee_id,
                date__year=year,
                date__month=SalaryCalculationService._get_month_number(month),
                attendance_status='ABSENT'
            ).count()

            return {
                'total_working_days': employee_working_days,
                'present_days': Decimal(str(summary.present_days)),
                'absent_days': Decimal(str(explicit_absent_count)),  # Only explicit absences
                'ot_hours': summary.ot_hours,
                'late_minutes': summary.late_minutes,
            }
        
        # If MonthlyAttendanceSummary doesn't have data, try the Attendance model (monthly summary format)
        attendance_record = Attendance.objects.filter(
            tenant=employee.tenant,
            employee_id=employee.employee_id,
            date__year=year,
            date__month=month_num,
        ).first()

        if attendance_record and not force_calculate_partial:
            employee_working_days = SalaryCalculationService._calculate_employee_working_days(
                employee, year, month
            )

            return {
                'total_working_days': employee_working_days,
                'present_days': Decimal(str(attendance_record.present_days)),
                'absent_days': Decimal(str(attendance_record.absent_days)),
                'ot_hours': attendance_record.ot_hours,
                'late_minutes': attendance_record.late_minutes,
            }
        
        # Otherwise, fall back to on-the-fly aggregation of DailyAttendance
        from django.db.models import Sum

        # Determine start & end dates for the period (supports partial month when force_calculate_partial=True)
        if force_calculate_partial:
            current_date = date.today()
            start_date = employee.date_of_joining if (
                employee.date_of_joining
                and employee.date_of_joining.year == year
                and employee.date_of_joining.month == month_num
            ) else date(year, month_num, 1)

            end_date = current_date if (year == current_date.year and month_num == current_date.month) else date(
                year, month_num, (date(year, month_num, 1).replace(day=28) + timedelta(days=4)).day
            )

            employee_working_days = SalaryCalculationService._calculate_employee_working_days_for_period(
                employee, start_date, end_date
            )
        else:
            employee_working_days = SalaryCalculationService._calculate_employee_working_days(employee, year, month)

        daily_qs = DailyAttendance.objects.filter(
            tenant=employee.tenant,
            employee_id=employee.employee_id,
            date__year=year,
            date__month=month_num,
        )

        if force_calculate_partial:
            daily_qs = daily_qs.filter(date__range=[start_date, end_date])

        if daily_qs.exists():
            present_full = daily_qs.filter(attendance_status__in=["PRESENT", "PAID_LEAVE"]).count()
            half_count = daily_qs.filter(attendance_status="HALF_DAY").count()
            total_present = present_full + (half_count * 0.5)
            
            # Count only explicit ABSENT entries, not missing days
            explicit_absent = daily_qs.filter(attendance_status="ABSENT").count()
            # Add half day absences
            explicit_absent += half_count * 0.5

            aggregates = daily_qs.aggregate(total_ot=Sum("ot_hours"), total_late=Sum("late_minutes"))

            return {
                'total_working_days': employee_working_days,
                'present_days': Decimal(str(total_present)),
                'absent_days': Decimal(str(explicit_absent)),  # Only explicit absences
                'ot_hours': aggregates["total_ot"] or Decimal('0'),
                'late_minutes': aggregates["total_late"] or 0,
            }
        
        # Default values if no data found - assume no attendance logged
        # For new employees with no records: present=0, absent=0 (not assumed absent)
        return {
            'total_working_days': employee_working_days,
            'present_days': Decimal('0'),  # No default attendance - must be explicitly logged
            'absent_days': Decimal('0'),  # No default absent - only count explicitly logged absences
            'ot_hours': Decimal('0'),
            'late_minutes': 0,
        }
    
    @staticmethod
    def _calculate_employee_working_days_for_period(employee: 'EmployeeProfile', start_date, end_date) -> int:
        """
        Calculate working days for a specific employee for a date range considering their off days
        """
        # Get employee's off days
        off_days = []
        if employee.off_monday: off_days.append(0)  # Monday
        if employee.off_tuesday: off_days.append(1)  # Tuesday
        if employee.off_wednesday: off_days.append(2)  # Wednesday
        if employee.off_thursday: off_days.append(3)  # Thursday
        if employee.off_friday: off_days.append(4)  # Friday
        if employee.off_saturday: off_days.append(5)  # Saturday
        if employee.off_sunday: off_days.append(6)  # Sunday
        
        # Count working days for this employee in the date range
        working_days = 0
        current_date = start_date
        
        while current_date <= end_date:
            # Check if this day is not in employee's off days
            if current_date.weekday() not in off_days:
                working_days += 1
            current_date = current_date + timedelta(days=1)
        
        return working_days
    
    @staticmethod
    def _get_advance_balance(employee_id: str) -> Decimal:
        """Calculate current advance balance for an employee"""
        
        # Sum all advances with PENDING or PARTIALLY_PAID status using remaining_balance
        total_advances = AdvanceLedger.objects.filter(
            employee_id=employee_id,
            status__in=['PENDING', 'PARTIALLY_PAID']
        ).aggregate(total=Sum('remaining_balance'))['total'] or Decimal('0')
        
        return total_advances
    
    @staticmethod
    def update_advance_deduction(tenant, payroll_period_id: int, employee_id: str, new_amount: Decimal, admin_user: str):
        """
        Update advance deduction amount for a specific employee and period
        
        Args:
            tenant: Tenant instance
            payroll_period_id: PayrollPeriod ID
            employee_id: Employee ID
            new_amount: New deduction amount
            admin_user: Admin user making the change
        """
        
        calculated_salary = CalculatedSalary.objects.get(
            tenant=tenant,
            payroll_period_id=payroll_period_id,
            employee_id=employee_id
        )
        
        old_amount = calculated_salary.advance_deduction_amount
        calculated_salary.advance_deduction_amount = new_amount
        calculated_salary.advance_deduction_editable = True
        calculated_salary.save()  # This will trigger recalculation
        
        # Log the adjustment
        SalaryAdjustment.objects.create(
            tenant=tenant,
            calculated_salary=calculated_salary,
            adjustment_type='ADVANCE_OVERRIDE',
            amount=new_amount - old_amount,
            reason=f"Admin override: Changed advance deduction from {old_amount} to {new_amount}",
            created_by=admin_user
        )
        
        return calculated_salary
    
    @staticmethod
    def lock_payroll_period(tenant, payroll_period_id: int):
        """Lock a payroll period to prevent further modifications"""
        payroll_period = PayrollPeriod.objects.get(tenant=tenant, id=payroll_period_id)
        payroll_period.is_locked = True
        payroll_period.save()
        return payroll_period
    
    @staticmethod
    def mark_salary_as_paid(tenant, calculated_salary_id: int, payment_date: date = None):
        """Mark a calculated salary as paid and update advance ledger status"""
        from .models import AdvanceLedger
        
        calculated_salary = CalculatedSalary.objects.get(tenant=tenant, id=calculated_salary_id)
        calculated_salary.is_paid = True
        calculated_salary.payment_date = payment_date or date.today()
        calculated_salary.save()
        
        # Update advance ledger status based on advance deduction
        if calculated_salary.advance_deduction_amount > 0:
            # Get all pending advances for this employee
            pending_advances = AdvanceLedger.objects.filter(
                tenant=tenant,
                employee_id=calculated_salary.employee_id,
                status__in=['PENDING','PARTIALLY_PAID']
            ).order_by('advance_date')  # Process oldest advances first
            
            remaining_deduction = calculated_salary.advance_deduction_amount
            
            for advance in pending_advances:
                if remaining_deduction <= 0:
                    break
                    
                current_balance = advance.remaining_balance
                if current_balance <= remaining_deduction:
                    # This advance is fully paid
                    advance.status = 'REPAID'
                    advance.remaining_balance = Decimal('0')
                    advance.save()
                    remaining_deduction -= current_balance
                else:
                    # This advance is partially paid - reduce the remaining_balance
                    advance.remaining_balance -= remaining_deduction
                    advance.status = 'PARTIALLY_PAID'
                    advance.save()
                    remaining_deduction = 0
        
        return calculated_salary
    
    @staticmethod
    def _get_month_number(month_name: str) -> int:
        """Convert month name to number"""
        month_mapping = {
            'JANUARY': 1, 'FEBRUARY': 2, 'MARCH': 3, 'APRIL': 4,
            'MAY': 5, 'JUNE': 6, 'JULY': 7, 'AUGUST': 8,
            'SEPTEMBER': 9, 'OCTOBER': 10, 'NOVEMBER': 11, 'DECEMBER': 12
        }
        return month_mapping.get(month_name.upper(), 1)
    
    @staticmethod
    def get_salary_summary(tenant, payroll_period_id: int):
        """Get summary of calculated salaries for a period"""
        
        calculated_salaries = CalculatedSalary.objects.filter(
            tenant=tenant,
            payroll_period_id=payroll_period_id
        )
        
        summary = {
            'total_employees': calculated_salaries.count(),
            'total_gross_salary': sum(cs.gross_salary for cs in calculated_salaries),
            'total_tds': sum(cs.tds_amount for cs in calculated_salaries),
            'total_advance_deductions': sum(cs.advance_deduction_amount for cs in calculated_salaries),
            'total_net_payable': sum(cs.net_payable for cs in calculated_salaries),
            'paid_count': calculated_salaries.filter(is_paid=True).count(),
            'pending_count': calculated_salaries.filter(is_paid=False).count(),
        }
        
        return summary 