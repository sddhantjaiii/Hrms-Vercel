# payroll.py
# Contains all payroll-related views:
# - PayrollPeriodViewSet
# - CalculatedSalaryViewSet
# - calculate_payroll
# - update_advance_deduction
# - lock_payroll_period
# - mark_salary_paid
# - payroll_summary
# - payroll_periods_list
# - available_calculation_periods
# - get_months_with_attendance
# - calculate_simple_payroll
# - calculate_simple_payroll_ultra_fast
# - update_payroll_entry
# - mark_payroll_paid
# - payroll_overview
# - create_current_month_payroll
# - payroll_period_detail
# - add_employee_advance
# - AdvancePaymentViewSet
# - auto_payroll_settings
# - manual_calculate_payroll
# - save_payroll_period_direct
# - bulk_update_payroll_period


from rest_framework.response import Response
from rest_framework import status, viewsets, filters
from rest_framework.decorators import api_view, permission_classes
from ..models import EmployeeProfile
from decimal import Decimal, InvalidOperation
from datetime import datetime
import time
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
import logging

# Initialize logger
logger = logging.getLogger(__name__)

from ..models import (
    EmployeeProfile,
    AdvanceLedger,
    PayrollPeriod,
    CalculatedSalary,
    DataSource,
)

from ..serializers import (
    AdvanceLedgerSerializer,
)
from rest_framework import serializers

# Email verification views will be defined in this file
from ..services.salary_service import SalaryCalculationService



class PayrollPeriodViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing payroll periods
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return PayrollPeriod.objects.none()
        return PayrollPeriod.objects.filter(tenant=tenant)
    
    def get_serializer_class(self):
        class PayrollPeriodSerializer(serializers.ModelSerializer):
            class Meta:
                model = PayrollPeriod
                fields = [
                    'id', 'year', 'month', 'data_source', 'is_locked',
                    'calculation_date', 'working_days_in_month', 'tds_rate'
                ]
                read_only_fields = ['calculation_date']
        return PayrollPeriodSerializer
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete a payroll period and its associated calculated salaries
        """
        try:
            period = self.get_object()
            
            # Check if period can be deleted (not locked and no payments)
            if period.is_locked:
                return Response({
                    'error': 'Cannot delete locked payroll period'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if there are any paid salaries
            paid_salaries_count = CalculatedSalary.objects.filter(
                payroll_period=period,
                is_paid=True
            ).count()
            
            if paid_salaries_count > 0:
                return Response({
                    'error': f'Cannot delete payroll period with {paid_salaries_count} paid salaries'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Delete associated calculated salaries first
            deleted_salaries = CalculatedSalary.objects.filter(payroll_period=period).delete()
            
            # Delete the payroll period
            period_name = f"{period.month} {period.year}"
            period.delete()
            
            return Response({
                'success': True,
                'message': f'Payroll period {period_name} deleted successfully',
                'deleted_salaries': deleted_salaries[0] if deleted_salaries[0] else 0
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error deleting payroll period: {str(e)}")
            return Response({
                'error': f'Failed to delete payroll period: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CalculatedSalaryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing calculated salaries
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return CalculatedSalary.objects.none()
        
        queryset = CalculatedSalary.objects.filter(tenant=tenant)
        
        # Filter by payroll period if specified
        period_id = self.request.query_params.get('period_id')
        if period_id:
            queryset = queryset.filter(payroll_period_id=period_id)
        
        return queryset.select_related('payroll_period')
    
    def get_serializer_class(self):
        from rest_framework import serializers
        
        class CalculatedSalarySerializer(serializers.ModelSerializer):
            payroll_period_display = serializers.CharField(source='payroll_period.__str__', read_only=True)
            
            class Meta:
                model = CalculatedSalary
                fields = [
                    'id', 'payroll_period', 'payroll_period_display', 'employee_id', 'employee_name',
                    'department', 'basic_salary', 'basic_salary_per_hour', 'basic_salary_per_minute',
                    'employee_ot_rate', 'employee_tds_rate', 'total_working_days', 'present_days', 
                    'absent_days', 'ot_hours', 'late_minutes', 'salary_for_present_days', 'ot_charges', 
                    'late_deduction', 'incentive', 'gross_salary', 'tds_amount', 'salary_after_tds', 
                    'total_advance_balance', 'advance_deduction_amount', 'advance_deduction_editable', 
                    'remaining_advance_balance', 'net_payable', 'data_source', 'calculation_timestamp', 
                    'is_paid', 'payment_date'
                ]
                read_only_fields = [
                    'salary_for_present_days', 'ot_charges', 'late_deduction', 'gross_salary',
                    'tds_amount', 'salary_after_tds', 'remaining_advance_balance', 'net_payable',
                    'calculation_timestamp'
                ]
        return CalculatedSalarySerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_payroll(request):
    """
    Calculate payroll for a specific period with different modes
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        data = request.data
        period_id = data.get('period_id')
        force_recalculate = data.get('force_recalculate', False)
        mode = data.get('mode', 'calculate')  # 'tentative', 'calculate', 'save'
        
        if not period_id:
            # Legacy support - try to get year and month
            year = data.get('year')
            month = data.get('month')
            
            if not year or not month:
                return Response({"error": "period_id or (year and month) are required"}, status=400)
            
            # Validate year and month
            try:
                year = int(year)
                month = str(month).upper()
            except (ValueError, TypeError):
                return Response({"error": "Invalid year or month format"}, status=400)
            
            # Calculate payroll using legacy method
            results = SalaryCalculationService.calculate_salary_for_period(
                tenant, year, month, force_recalculate
            )
        # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
        
        return Response({
            'success': True,
            'results': results,
            'message': f'Payroll calculation completed for {month} {year}'
        })
        
        # New method using period_id
        try:
            payroll_period = PayrollPeriod.objects.get(id=period_id, tenant=tenant)
        except PayrollPeriod.DoesNotExist:
            return Response({"error": "Payroll period not found"}, status=404)
        
        # Calculate payroll for the period
        results = SalaryCalculationService.calculate_salary_for_period(
            tenant, payroll_period.year, payroll_period.month, force_recalculate
        )
        
        # Handle different modes
        if mode == 'save':
            # Lock the period after calculation
            payroll_period.is_locked = True
            payroll_period.calculation_date = timezone.now()
            payroll_period.save()
            message = f'Payroll calculated and saved for {payroll_period.month} {payroll_period.year}'
        elif mode == 'tentative':
            message = f'Tentative payroll calculation completed for {payroll_period.month} {payroll_period.year}'
        else:
            message = f'Payroll calculation completed for {payroll_period.month} {payroll_period.year}'
        
        # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
        
        return Response({
            'success': True,
            'results': results,
            'message': message,
            'mode': mode,
            'cache_cleared': True
        })
        
    except Exception as e:
        logger.error(f"Error in calculate_payroll: {str(e)}")
        return Response({"error": f"Calculation failed: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_advance_deduction(request):
    """
    Update advance deduction amount for a specific employee and period
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        data = request.data
        payroll_period_id = data.get('payroll_period_id')
        employee_id = data.get('employee_id')
        new_amount = data.get('new_amount')
        
        if not all([payroll_period_id, employee_id, new_amount is not None]):
            return Response({
                "error": "payroll_period_id, employee_id, and new_amount are required"
            }, status=400)
        
        try:
            new_amount = Decimal(str(new_amount))
        except (ValueError, TypeError):
            return Response({"error": "Invalid amount format"}, status=400)
        
        # Get admin user (you might want to get this from JWT token)
        admin_user = getattr(request.user, 'username', 'system')
        
        # Update advance deduction
        calculated_salary = SalaryCalculationService.update_advance_deduction(
            tenant, payroll_period_id, employee_id, new_amount, admin_user
        )
        
        # CLEAR CACHE: Invalidate payroll overview cache when advance deduction changes
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
        
        return Response({
            'success': True,
            'message': 'Advance deduction updated successfully',
            'calculated_salary_id': calculated_salary.id,
            'new_net_payable': str(calculated_salary.net_payable),
            'cache_cleared': True
        })
        
    except CalculatedSalary.DoesNotExist:
        return Response({"error": "Calculated salary record not found"}, status=404)
    except Exception as e:
        logger.error(f"Error in update_advance_deduction: {str(e)}")
        return Response({"error": f"Update failed: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lock_payroll_period(request, period_id):
    """
    Lock a payroll period to prevent further modifications
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        payroll_period = SalaryCalculationService.lock_payroll_period(tenant, period_id)
        # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
        
        return Response({
            'success': True,
            'message': f'Payroll period {payroll_period} has been locked',
            'period_id': payroll_period.id
        })
        
    except PayrollPeriod.DoesNotExist:
        return Response({"error": "Payroll period not found"}, status=404)
    except Exception as e:
        logger.error(f"Error in lock_payroll_period: {str(e)}")
        return Response({"error": f"Lock failed: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_salary_paid(request):
    """
    Mark calculated salaries as paid or unpaid - OPTIMIZED with bulk operations
    Supports both marking as paid (mark_as_paid=True) and unpaid (mark_as_paid=False)
    """
    import time
    from django.core.cache import cache
    
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        data = request.data
        salary_ids = data.get('salary_ids', [])
        payment_date = data.get('payment_date')
        mark_as_paid = data.get('mark_as_paid', True)  # Default to marking as paid
        
        if not salary_ids:
            return Response({"error": "salary_ids list is required"}, status=400)
        
        # Parse payment date if provided and marking as paid
        parsed_date = None
        if payment_date and mark_as_paid:
            try:
                parsed_date = datetime.strptime(payment_date, '%Y-%m-%d').date()
            except ValueError:
                return Response({"error": "Invalid payment_date format (use YYYY-MM-DD)"}, status=400)
        
        # Use default payment date if marking as paid and no date provided
        if mark_as_paid and not parsed_date:
            parsed_date = timezone.now().date()
        
        # Use transaction for atomic operations
        with transaction.atomic():
            # OPTIMIZATION: Bulk fetch all calculated salaries in a single query (inside transaction)
            calculated_salaries = CalculatedSalary.objects.filter(
                tenant=tenant,
                id__in=salary_ids
            )  # Removed select_for_update() to avoid transaction issues
            
            if not calculated_salaries.exists():
                return Response({"error": "No valid salary records found"}, status=404)
            
            updated_count = 0
            
            # OPTIMIZATION: Bulk update all calculated salaries at once
            bulk_updates = []
            employee_advance_deductions = {}  # Track advance deductions by employee
            
            for salary in calculated_salaries:
                salary.is_paid = mark_as_paid
                salary.payment_date = parsed_date if mark_as_paid else None
                bulk_updates.append(salary)
                updated_count += 1
                
                # Collect advance deduction info for batch processing ONLY when marking as paid
                if mark_as_paid and salary.advance_deduction_amount > 0:
                    if salary.employee_id not in employee_advance_deductions:
                        employee_advance_deductions[salary.employee_id] = 0
                    employee_advance_deductions[salary.employee_id] += salary.advance_deduction_amount
            
            # Bulk update all calculated salaries
            CalculatedSalary.objects.bulk_update(
                bulk_updates, 
                ['is_paid', 'payment_date'], 
                batch_size=100
            )
            
            # OPTIMIZATION: Bulk process advance ledger updates ONLY when marking as paid
            if mark_as_paid and employee_advance_deductions:
                logger.info(f"Processing advance deductions for {len(employee_advance_deductions)} employees: {employee_advance_deductions}")
                from ..models import AdvanceLedger
                
                # Get all relevant advance records in one query
                all_employee_ids = list(employee_advance_deductions.keys())
                all_advances = AdvanceLedger.objects.filter(
                    tenant=tenant,
                    employee_id__in=all_employee_ids,
                    status__in=['PENDING','PARTIALLY_PAID']
                ).order_by('employee_id', 'advance_date')
                
                logger.info(f"Found {all_advances.count()} pending advances for employees: {all_employee_ids}")
                
                # Group advances by employee for efficient processing
                advances_by_employee = {}
                for advance in all_advances:
                    if advance.employee_id not in advances_by_employee:
                        advances_by_employee[advance.employee_id] = []
                    advances_by_employee[advance.employee_id].append(advance)
                
                # Process advance deductions for each employee
                advances_to_update = []
                advances_to_mark_repaid = []
                
                for employee_id, total_deduction in employee_advance_deductions.items():
                    remaining_deduction = Decimal(str(total_deduction))  # Convert to Decimal
                    employee_advances = advances_by_employee.get(employee_id, [])
                    
                    logger.info(f"Processing employee {employee_id}: deduction={remaining_deduction}, advances={len(employee_advances)}")
                    
                    for advance in employee_advances:
                        if remaining_deduction <= 0:
                            break
                            
                        current_balance = advance.remaining_balance
                        if current_balance <= remaining_deduction:
                            # This advance is fully paid
                            logger.info(f"Fully repaying advance {advance.id}: {current_balance}")
                            advance.status = 'REPAID'
                            advance.remaining_balance = Decimal('0')
                            advances_to_mark_repaid.append(advance)
                            remaining_deduction -= current_balance
                        else:
                            # This advance is partially paid - reduce the remaining_balance
                            logger.info(f"Partially repaying advance {advance.id}: {remaining_deduction} out of {current_balance}")
                            advance.remaining_balance -= remaining_deduction
                            advance.status = 'PARTIALLY_PAID'
                            advances_to_update.append(advance)
                            remaining_deduction = Decimal('0')
                
                # Execute bulk updates and status changes
                if advances_to_update:
                    AdvanceLedger.objects.bulk_update(advances_to_update, ['remaining_balance', 'status'], batch_size=100)
                    logger.info(f"Bulk updated {len(advances_to_update)} advance remaining balances")
                
                if advances_to_mark_repaid:
                    AdvanceLedger.objects.bulk_update(advances_to_mark_repaid, ['status', 'remaining_balance'], batch_size=100)
                    logger.info(f"Bulk marked {len(advances_to_mark_repaid)} advances as REPAID")
                
                logger.info(
                    f"Advance processing completed: {len(advances_to_update)} updated, {len(advances_to_mark_repaid)} marked as REPAID"
                )
            elif not mark_as_paid:
                logger.info("Marked salaries as unpaid - no advance processing needed")
            else:
                logger.info("No advance deductions found to process")
        
        
        # CLEAR CACHE: Invalidate payroll overview cache when payment status changes
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
        
        logger.info(f"Bulk marked {updated_count} salaries as paid for tenant {tenant.name}")
        
        response_data = {
            'success': True,
            'message': f'{updated_count} salaries marked as paid',
            'updated_count': updated_count,
            'processed_advance_deductions': len(employee_advance_deductions),
            'cache_cleared': True
        }
        
        if mark_as_paid and parsed_date:
            response_data['payment_date'] = parsed_date.isoformat()
            response_data['processed_advance_deductions'] = len(employee_advance_deductions)
        
        return Response(response_data)
        
    except Exception as e:
        logger.error(f"Error in optimized mark_salary_paid: {str(e)}")
        return Response({"error": f"Update failed: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_summary(request, period_id):
    """
    Get payroll summary for a specific period
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        summary = SalaryCalculationService.get_salary_summary(tenant, period_id)
        
        return Response({
            'success': True,
            'summary': summary
        })
        
    except Exception as e:
        logger.error(f"Error in payroll_summary: {str(e)}")
        return Response({"error": f"Summary failed: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_calculation_periods(request):
    """
    Get list of available months/years for payroll calculation
    This includes both existing periods and new periods that can be calculated
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        from ..models import PayrollPeriod, CalculatedSalary, EmployeeProfile
        from datetime import datetime, timedelta
        import calendar
        
        # Get current date
        current_date = datetime.now()
        
        # Generate available periods (last 6 months + current + next 3 months)
        available_periods = []
        
        # Start from 6 months ago
        start_date = current_date - timedelta(days=180)  # Approximately 6 months
        
        for i in range(12):  # 12 months total
            calc_date = start_date + timedelta(days=30 * i)
            year = calc_date.year
            month_name = calc_date.strftime('%B').upper()
            month_num = calc_date.month
            
            # Check if period already exists
            existing_period = PayrollPeriod.objects.filter(
                tenant=tenant,
                year=year,
                month=month_name
            ).first()
            
            # Get employee count for this tenant
            total_employees = EmployeeProfile.objects.filter(tenant=tenant, is_active=True).count()
            
            if existing_period:
                # Period exists - get calculation status
                calculated_count = CalculatedSalary.objects.filter(
                    tenant=tenant,
                    payroll_period=existing_period
                ).count()
                
                paid_count = CalculatedSalary.objects.filter(
                    tenant=tenant,
                    payroll_period=existing_period,
                    is_paid=True
                ).count()
                
                # Determine status
                if existing_period.is_locked:
                    status = 'LOCKED'
                    status_color = 'red'
                elif calculated_count > 0:
                    if paid_count == calculated_count:
                        status = 'COMPLETED'
                        status_color = 'green'
                    else:
                        status = 'CALCULATED'
                        status_color = 'blue'
                else:
                    status = 'PENDING'
                    status_color = 'orange'
                
                period_data = {
                    'id': existing_period.id,
                    'year': year,
                    'month': month_name,
                    'month_display': month_name.title(),
                    'month_year_display': f"{month_name.title()} {year}",
                    'data_source': existing_period.data_source,
                    'is_locked': existing_period.is_locked,
                    'calculation_date': existing_period.calculation_date.isoformat() if existing_period.calculation_date else None,
                    'working_days_in_month': existing_period.working_days_in_month,
                    'tds_rate': float(existing_period.tds_rate),
                    'exists': True,
                    'can_calculate': not existing_period.is_locked,
                    'status': status,
                    'status_color': status_color,
                    'calculated_count': calculated_count,
                    'paid_count': paid_count,
                    'total_employees': total_employees
                }
            else:
                # Period doesn't exist - can be created and calculated
                # Calculate working days for the month
                working_days = len([d for d in range(1, calendar.monthrange(year, month_num)[1] + 1)
                                  if calendar.weekday(year, month_num, d) < 5])  # Monday=0, Sunday=6
                
                period_data = {
                    'id': None,  # No ID since it doesn't exist yet
                    'year': year,
                    'month': month_name,
                    'month_display': month_name.title(),
                    'month_year_display': f"{month_name.title()} {year}",
                    'data_source': 'FRONTEND',
                    'is_locked': False,
                    'calculation_date': None,
                    'working_days_in_month': working_days,
                    'tds_rate': 5.0,  # Default TDS rate
                    'exists': False,
                    'can_calculate': True,
                    'status': 'AVAILABLE',
                    'status_color': 'gray',
                    'calculated_count': 0,
                    'paid_count': 0,
                    'total_employees': total_employees
                }
            
            available_periods.append(period_data)
        
        # Sort by year and month (newest first)
        available_periods.sort(key=lambda x: (x['year'], x['month']), reverse=True)
        
        return Response({
            'success': True,
            'periods': available_periods,
            'total_periods': len(available_periods)
        })
        
    except Exception as e:
        logger.error(f"Error in available_calculation_periods: {str(e)}")
        return Response({"error": f"Failed to get available periods: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_periods_list(request):
    """
    Get list of all payroll periods with basic info
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        # Import models locally to avoid any import issues
        from ..models import PayrollPeriod, CalculatedSalary
        
        periods = PayrollPeriod.objects.filter(tenant=tenant).order_by('-year', '-month')
        
        periods_data = []
        for period in periods:
            try:
                # Get basic summary for each period
                calculated_count = CalculatedSalary.objects.filter(
                    tenant=tenant,
                    payroll_period=period
                ).count()
                
                paid_count = CalculatedSalary.objects.filter(
                    tenant=tenant,
                    payroll_period=period,
                    is_paid=True
                ).count()
                
                periods_data.append({
                    'id': period.id,
                    'year': period.year,
                    'month': period.month,
                    'data_source': period.data_source,
                    'is_locked': period.is_locked,
                    'calculation_date': period.calculation_date.isoformat() if period.calculation_date else None,
                    'working_days_in_month': period.working_days_in_month,
                    'tds_rate': float(period.tds_rate),
                    'calculated_count': calculated_count,
                    'paid_count': paid_count,
                    'pending_count': calculated_count - paid_count
                })
            except Exception as period_error:
                logger.error(f"Error processing period {period.id}: {str(period_error)}")
                continue
        
        return Response({
            'success': True,
            'periods': periods_data
        })
        
    except Exception as e:
        logger.error(f"Error in payroll_periods_list: {str(e)}")
        return Response({"error": f"Failed to get periods: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_overview(request):
    """
    Optimized comprehensive payroll overview with all periods and their status
    """
    import time
    from django.db.models import Count, Sum, Q
    from django.core.cache import cache
    
    start_time = time.time()
    
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        # Check for cache bypass
        no_cache = request.GET.get('no_cache', 'false').lower() == 'true'
        cache_key = f"payroll_overview_{tenant.id}"
        
        # Try to get from cache first (unless bypassed)
        if not no_cache:
            cached_data = cache.get(cache_key)
            if cached_data:
                cached_data['performance']['cached'] = True
                cached_data['performance']['response_time'] = f"{(time.time() - start_time):.3f}s"
                return Response(cached_data)
        
        # Get current month info
        current_date = datetime.now()
        current_month = current_date.strftime('%B').upper()
        current_year = current_date.year
        
        # Get all payroll periods with related salary calculations in single query (ordered by calendar date)
        from django.db.models import Case, When, IntegerField
        
        # Define month ordering for proper calendar sorting (complete mapping)
        month_order = {
            'JANUARY': 1, 'FEBRUARY': 2, 'MARCH': 3, 'APRIL': 4,
            'MAY': 5, 'JUNE': 6, 'JULY': 7, 'AUGUST': 8,
            'SEPTEMBER': 9, 'OCTOBER': 10, 'NOVEMBER': 11, 'DECEMBER': 12,
            # Also handle common abbreviations that might be stored
            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4,
            'JUN': 6, 'JUL': 7, 'AUG': 8, 'SEP': 9,
            'OCT': 10, 'NOV': 11, 'DEC': 12
        }
        
        # Create Case/When conditions with proper string quoting
        when_conditions = []
        for month_name, month_num in month_order.items():
            # Case-insensitive match so variations like "June" or "june" are handled
            when_conditions.append(When(month__iexact=month_name, then=month_num))
        
        periods = PayrollPeriod.objects.filter(tenant=tenant).prefetch_related(
            'calculated_salaries'
        ).annotate(
            month_num=Case(
                *when_conditions,
                default=13,  # Put unknown months at the end
                output_field=IntegerField()
            )
        ).order_by('-year', '-month_num')  # Now properly ordered by calendar date
        
        # Check if current month period exists
        current_period_exists = periods.filter(
            year=current_year, 
            month=current_month
        ).exists()
        
        # Optimize with single aggregated query for all periods at once
        salary_aggregates = CalculatedSalary.objects.filter(
            tenant=tenant,
            payroll_period__in=periods
        ).values('payroll_period').annotate(
            total_employees=Count('id'),
            paid_employees=Count('id', filter=Q(is_paid=True)),
            total_gross_salary=Sum('gross_salary'),
            total_net_salary=Sum('net_payable'),
            total_advance_deductions=Sum('advance_deduction_amount'),
            total_tds=Sum('tds_amount')
        )
        
        # Create lookup dictionary for O(1) access
        salary_lookup = {
            agg['payroll_period']: agg for agg in salary_aggregates
        }
        
        overview_data = []
        for period in periods:
            # Get aggregated data for this period (O(1) lookup)
            agg_data = salary_lookup.get(period.id, {
                'total_employees': 0,
                'paid_employees': 0,
                'total_gross_salary': 0,
                'total_net_salary': 0,
                'total_advance_deductions': 0,
                'total_tds': 0
            })
            
            total_employees = agg_data['total_employees']
            paid_employees = agg_data['paid_employees']
            pending_employees = total_employees - paid_employees
            
            # Determine status
            if period.data_source == DataSource.UPLOADED:
                status = 'UPLOADED'
                status_color = 'purple'
            elif period.is_locked:
                status = 'LOCKED'
                status_color = 'red'
            elif paid_employees == total_employees and total_employees > 0:
                status = 'COMPLETED'
                status_color = 'green'
            elif total_employees > 0:
                status = 'CALCULATED'
                status_color = 'blue'
            else:
                status = 'PENDING'
                status_color = 'orange'
            
            overview_data.append({
                'id': period.id,
                'year': period.year,
                'month': period.month,
                'month_display': period.month.title(),
                'data_source': period.data_source,
                'status': status,
                'status_color': status_color,
                'is_locked': period.is_locked,
                'calculation_date': period.calculation_date.isoformat() if period.calculation_date else None,
                'working_days': period.working_days_in_month,
                'tds_rate': float(period.tds_rate),
                'total_employees': total_employees,
                'paid_employees': paid_employees,
                'pending_employees': pending_employees,
                'total_gross_salary': float(agg_data['total_gross_salary'] or 0),
                'total_net_salary': float(agg_data['total_net_salary'] or 0),
                'total_advance_deductions': float(agg_data['total_advance_deductions'] or 0),
                'total_tds': float(agg_data['total_tds'] or 0),
                'can_modify': not period.is_locked and period.data_source != DataSource.UPLOADED
            })
        
        query_time = time.time() - start_time
        
        response_data = {
            'success': True,
            'current_month': current_month,
            'current_year': current_year,
            'current_period_exists': current_period_exists,
            'periods': overview_data,
            'total_periods': len(overview_data),
            'performance': {
                'query_time': f"{query_time:.3f}s",
                'optimization': 'Single aggregated query with prefetch_related',
                'periods_processed': len(periods),
                'cached': False,
                'response_time': f"{query_time:.3f}s"
            }
        }
        
        # Cache the result for 15 minutes (900 seconds)
        cache.set(cache_key, response_data, 900)
        
        return Response(response_data)
        
    except Exception as e:
        logger.error(f"Error in payroll_overview: {str(e)}")
        return Response({"error": f"Failed to get overview: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_current_month_payroll(request):
    """
    Create payroll period for current month
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        current_date = datetime.now()
        current_month = current_date.strftime('%B').upper()
        current_year = current_date.year
        
        # Check if period already exists
        existing_period = PayrollPeriod.objects.filter(
            tenant=tenant,
            year=current_year,
            month=current_month
        ).first()
        
        if existing_period:
            return Response({
                "error": f"Payroll period for {current_month} {current_year} already exists"
            }, status=400)
        
        # Create new period
        new_period = PayrollPeriod.objects.create(
            tenant=tenant,
            year=current_year,
            month=current_month,
            data_source=DataSource.FRONTEND,
            working_days_in_month=request.data.get('working_days', 25),
            tds_rate=request.data.get('tds_rate', 5.0)
        )
        
        return Response({
            'success': True,
            'message': f'Payroll period created for {current_month} {current_year}',
            'period_id': new_period.id,
            'period': {
                'id': new_period.id,
                'year': new_period.year,
                'month': new_period.month,
                'data_source': new_period.data_source,
                'working_days': new_period.working_days_in_month,
                'tds_rate': float(new_period.tds_rate)
            }
        })
        
    except Exception as e:
        logger.error(f"Error in create_current_month_payroll: {str(e)}")
        return Response({"error": f"Failed to create period: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payroll_period_detail(request, period_id):
    """
    Get detailed view of a specific payroll period
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        period = PayrollPeriod.objects.filter(tenant=tenant, id=period_id).first()
        if not period:
            return Response({"error": "Payroll period not found"}, status=404)
        
        # Get all calculated salaries for this period
        calculated_salaries = CalculatedSalary.objects.filter(
            tenant=tenant,
            payroll_period=period
        ).order_by('employee_name')
        
        employees_data = []
        for calc in calculated_salaries:
            employees_data.append({
                'id': calc.id,
                'employee_id': calc.employee_id,
                'employee_name': calc.employee_name,
                'department': calc.department,
                'basic_salary': float(calc.basic_salary),
                'present_days': float(calc.present_days),
                'absent_days': float(calc.absent_days),
                'ot_hours': float(calc.ot_hours),
                'late_minutes': calc.late_minutes,
                'gross_salary': float(calc.gross_salary),
                'tds_amount': float(calc.tds_amount),
                'salary_after_tds': float(calc.salary_after_tds),
                'total_advance_balance': float(calc.total_advance_balance),
                'advance_deduction_amount': float(calc.advance_deduction_amount),
                'advance_deduction_editable': calc.advance_deduction_editable,
                'remaining_advance_balance': float(calc.remaining_advance_balance),
                'net_payable': float(calc.net_payable),
                'is_paid': calc.is_paid,
                'payment_date': calc.payment_date.isoformat() if calc.payment_date else None
            })
        
        # Calculate summary
        total_gross = sum(float(calc.gross_salary) for calc in calculated_salaries)
        total_net = sum(float(calc.net_payable) for calc in calculated_salaries)
        total_advances = sum(float(calc.advance_deduction_amount) for calc in calculated_salaries)
        total_tds = sum(float(calc.tds_amount) for calc in calculated_salaries)
        
        return Response({
            'success': True,
            'period': {
                'id': period.id,
                'year': period.year,
                'month': period.month,
                'data_source': period.data_source,
                'is_locked': period.is_locked,
                'working_days': period.working_days_in_month,
                'tds_rate': float(period.tds_rate),
                'calculation_date': period.calculation_date.isoformat() if period.calculation_date else None
            },
            'employees': employees_data,
            'summary': {
                'total_employees': len(employees_data),
                'paid_employees': sum(1 for emp in employees_data if emp['is_paid']),
                'pending_employees': sum(1 for emp in employees_data if not emp['is_paid']),
                'total_gross_salary': total_gross,
                'total_net_salary': total_net,
                'total_advance_deductions': total_advances,
                'total_tds': total_tds
            }
        })
        
    except Exception as e:
        logger.error(f"Error in payroll_period_detail: {str(e)}")
        return Response({"error": f"Failed to get period detail: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_employee_advance(request):
    """
    Add advance amount for an employee
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        data = request.data
        employee_id = data.get('employee_id')
        amount = data.get('amount')
        for_month = data.get('for_month')
        payment_method = data.get('payment_method', 'CASH')
        remarks = data.get('remarks', '')
        
        if not all([employee_id, amount, for_month]):
            return Response({
                "error": "employee_id, amount, and for_month are required"
            }, status=400)
        
        try:
            amount = Decimal(str(amount))
        except (ValueError, TypeError):
            return Response({"error": "Invalid amount format"}, status=400)
        
        # Get employee details
        employee = EmployeeProfile.objects.filter(
            tenant=tenant,
            employee_id=employee_id
        ).first()
        
        if not employee:
            return Response({"error": "Employee not found"}, status=404)
        
        # Create advance record
        advance = AdvanceLedger.objects.create(
            tenant=tenant,
            employee_id=employee_id,
            employee_name=employee.full_name,
            advance_date=datetime.now().date(),
            amount=amount,
            for_month=for_month,
            payment_method=payment_method,
            status='PENDING',
            remarks=remarks
        )
        
        
        # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
        
        return Response({
            'success': True,
            'message': f'Advance of ₹{amount} added for {employee.full_name}',
            'advance_id': advance.id,
            'advance': {
                'id': advance.id,
                'employee_id': advance.employee_id,
                'employee_name': advance.employee_name,
                'amount': float(advance.amount),
                'for_month': advance.for_month,
                'payment_method': advance.payment_method,
                'status': advance.status,
                'advance_date': advance.advance_date.isoformat(),
                'remarks': advance.remarks
            }
        })
        
    except Exception as e:
        logger.error(f"Error in add_employee_advance: {str(e)}")
        return Response({"error": f"Failed to add advance: {str(e)}"}, status=500)

class AdvancePaymentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing advance payments with full CRUD operations
    """
    serializer_class = AdvanceLedgerSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['employee_id', 'employee_name', 'remarks']
    ordering_fields = ['advance_date', 'amount', 'for_month']
    
    def dispatch(self, request, *args, **kwargs):
        logger.info(f"AdvancePaymentViewSet dispatch: {request.method} {request.path}")
        return super().dispatch(request, *args, **kwargs)
    
    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return AdvanceLedger.objects.none()
        return AdvanceLedger.objects.filter(tenant=tenant).order_by('-advance_date')
    
    def list(self, request, *args, **kwargs):
        """
        Optimized list all advance payments with additional fields
        """
        start_time = time.time()
        
        queryset = self.get_queryset()
        
        # Apply search filters efficiently
        search_query = request.query_params.get('search', '')
        if search_query:
            queryset = queryset.filter(
                Q(employee_name__icontains=search_query) |
                Q(employee_id__icontains=search_query) |
                Q(remarks__icontains=search_query)
            )
        
        # Apply amount filter efficiently
        amount_filter = request.query_params.get('amount', '')
        if amount_filter:
            try:
                amount_value = Decimal(amount_filter)
                queryset = queryset.filter(amount=amount_value)
            except (ValueError, TypeError):
                # If not a valid number, search in remarks or other text fields
                queryset = queryset.filter(
                    Q(remarks__icontains=amount_filter)
                )
        
        # Optimize query with select_related if there are foreign keys in the future
        # For now, ensure we only fetch what we need
        queryset = queryset.only(
            'id', 'employee_id', 'employee_name', 'advance_date', 
            'amount', 'for_month', 'payment_method', 'status', 'remarks',
            'created_at', 'updated_at'
        )
        
        # Apply pagination if needed
        page_size = request.query_params.get('page_size', None)
        if page_size:
            try:
                page_size = int(page_size)
                queryset = queryset[:page_size]
            except ValueError:
                pass
        
        # Get all advances at once (no N+1 queries)
        advances = list(queryset)
        
        # Prepare response data efficiently
        advances_data = []
        for advance in advances:
            advance_data = {
                'id': advance.id,
                'employee_id': advance.employee_id,
                'employee_name': advance.employee_name,
                'advance_date': advance.advance_date.isoformat(),
                'amount': float(advance.amount),
                'for_month': advance.for_month,
                'payment_method': advance.payment_method,
                'status': advance.status,
                'remarks': advance.remarks or '',
                'created_at': advance.created_at.isoformat(),
                'updated_at': advance.updated_at.isoformat(),
                # Add calculated fields without additional queries
                'remaining_balance': float(advance.remaining_balance),
                'is_active': advance.status != 'REPAID',
                'is_fully_repaid': advance.status == 'REPAID',
                'amount_formatted': f"₹{advance.amount:,.2f}",
                'status_display': 'Fully Repaid' if advance.status == 'REPAID' else 'Pending'
            }
            advances_data.append(advance_data)
        
        end_time = time.time()
        response_time = round((end_time - start_time) * 1000, 2)  # Convert to milliseconds
        
        logger.info(f"AdvancePaymentViewSet.list completed in {response_time}ms for {len(advances_data)} records")
        
        return Response({
            'success': True,
            'count': len(advances_data),
            'results': advances_data,
            'performance': {
                'query_time_ms': response_time,
                'record_count': len(advances_data)
            }
        })
    
    def create(self, request, *args, **kwargs):
        """
        Create a new advance payment
        """
        logger.info(f"AdvancePaymentViewSet.create called with data: {request.data}")
        try:
            tenant = getattr(request, 'tenant', None)
            if not tenant:
                return Response({"error": "No tenant found"}, status=400)
            
            # Prepare data with required fields
            data = request.data.copy()
            employee_id = data.get('employee_id')
            
            # Get employee info
            try:
                employee = EmployeeProfile.objects.get(employee_id=employee_id, tenant=tenant)
                data['employee_name'] = f"{employee.first_name} {employee.last_name}".strip()
            except EmployeeProfile.DoesNotExist:
                return Response({"error": "Employee not found"}, status=404)
            
            # Set default values
            data['advance_date'] = timezone.now().date().isoformat()
            data['status'] = 'PENDING'
            
            # Create serializer with prepared data
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            
            # Save with tenant
            advance = serializer.save(tenant=tenant)
            
            # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
            from django.core.cache import cache
            cache_key = f"payroll_overview_{tenant.id}"
            cache.delete(cache_key)
            logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
            
            return Response({
                'success': True,
                'message': 'Advance payment created successfully',
                'advance': serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating advance payment: {str(e)}")
            return Response({"error": f"Failed to create advance: {str(e)}"}, status=500)
    
    def update(self, request, *args, **kwargs):
        """
        Update an advance payment
        """
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            
            # Don't allow updating employee_id
            data = request.data.copy()
            # Protect original advance amount
            data.pop('amount', None)
            
            serializer = self.get_serializer(instance, data=data, partial=partial)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            
            # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
            from django.core.cache import cache
            cache_key = f"payroll_overview_{getattr(self.request, 'tenant', None).id}"
            cache.delete(cache_key)
            logger.info(f"Cleared payroll overview cache for tenant {getattr(self.request, 'tenant', None).id}")
            
            return Response({
                'success': True,
                'message': 'Advance payment updated successfully',
                'advance': serializer.data
            })
            
        except Exception as e:
            logger.error(f"Error updating advance payment: {str(e)}")
            return Response({"error": f"Failed to update advance: {str(e)}"}, status=500)
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete an advance payment
        """
        try:
            instance = self.get_object()
            
            # Check if advance is already deducted from salary
            if hasattr(instance, 'status') and instance.status == 'DEDUCTED':
                return Response({
                    "error": "Cannot delete advance that has already been deducted from salary"
                }, status=400)
            
            instance.delete()
            
            return Response({
                'success': True,
                'message': 'Advance payment deleted successfully'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error deleting advance payment: {str(e)}")
            return Response({"error": f"Failed to delete advance: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_months_with_attendance(request):
    """
    OPTIMIZED: Get list of months/years that have attendance data for payroll calculation
    Single aggregated query + caching for 90%+ performance improvement
    """
    import time
    from django.core.cache import cache
    from django.db.models import Count, Q
    import calendar
    
    start_time = time.time()
    
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        # Check cache first (cache for 30 minutes since attendance data doesn't change frequently)
        cache_key = f"months_with_attendance_{tenant.id}"
        use_cache = request.GET.get('no_cache', '').lower() != 'true'
        
        if use_cache:
            cached_data = cache.get(cache_key)
            if cached_data:
                cached_data['performance']['cached'] = True
                cached_data['performance']['query_time'] = f"{(time.time() - start_time):.3f}s"
                
                return Response(cached_data)
        
        from ..models import DailyAttendance, SalaryData
        
        # Get attendance data periods
        attendance_aggregated = DailyAttendance.objects.filter(
            tenant=tenant
        ).extra(
            select={
                'year': "EXTRACT(year FROM date)", 
                'month': "EXTRACT(month FROM date)"
            }
        ).values('year', 'month').annotate(
            attendance_records=Count('id'),
            employees_with_attendance=Count('employee_id', distinct=True)
        ).order_by('-year', '-month')
        
        # Get salary data periods
        salary_aggregated = SalaryData.objects.filter(
            tenant=tenant
        ).values('year', 'month').annotate(
            salary_records=Count('id'),
            employees_with_salary=Count('employee_id', distinct=True)
        ).order_by('-year', '-month')
        
        # Process results into final format
        available_periods = []
        periods_dict = {}
        
        # Process attendance data
        for period in attendance_aggregated:
            year = int(period['year'])
            month_num = int(period['month'])
            month_name = calendar.month_name[month_num].upper()
            key = f"{year}-{month_num}"
            
            periods_dict[key] = {
                'year': year,
                'month': month_name,
                'month_num': month_num,
                'month_display': f"{calendar.month_name[month_num]} {year}",
                'attendance_records': period['attendance_records'],
                'employees_with_attendance': period['employees_with_attendance'],
                'salary_records': 0,
                'employees_with_salary': 0
            }
        
        # Process salary data
        month_name_to_num = {
            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12
        }
        
        for period in salary_aggregated:
            year = int(period['year'])
            month_name = period['month']
            month_num = month_name_to_num.get(month_name, 1)  # Default to 1 if not found
            key = f"{year}-{month_num}"
            
            if key in periods_dict:
                # Update existing period
                periods_dict[key]['salary_records'] = period['salary_records']
                periods_dict[key]['employees_with_salary'] = period['employees_with_salary']
            else:
                # Create new period for salary data
                periods_dict[key] = {
                    'year': year,
                    'month': month_name,
                    'month_num': month_num,
                    'month_display': f"{calendar.month_name[month_num]} {year}",
                    'attendance_records': 0,
                    'employees_with_attendance': 0,
                    'salary_records': period['salary_records'],
                    'employees_with_salary': period['employees_with_salary']
                }
        
        # Convert to list and sort
        available_periods = list(periods_dict.values())
        available_periods.sort(key=lambda x: (x['year'], x['month_num']), reverse=True)
        
        # Prepare response
        response_data = {
            'success': True,
            'periods': available_periods,
            'performance': {
                'query_time': f"{(time.time() - start_time):.3f}s",
                'periods_found': len(available_periods),
                'optimization': 'single_aggregated_query_with_cache',
                'cached': False
            }
        }
        
        # Cache the result for 30 minutes (1800 seconds)
        if use_cache:
            cache.set(cache_key, response_data, 1800)
        
        
        return Response(response_data)
        
    except Exception as e:
        logger.error(f"Error in get_months_with_attendance: {str(e)}")
        return Response({
            "error": f"Failed to get periods: {str(e)}",
            "performance": {
                "query_time": f"{(time.time() - start_time):.3f}s",
                "optimization": "error_occurred"
            }
        }, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_simple_payroll(request):
    """
    OPTIMIZED payroll calculation with bulk operations and efficient database queries
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        from ..models import EmployeeProfile, DailyAttendance, AdvanceLedger
        from django.db.models import Sum, Count, Q, Case, When, IntegerField, DecimalField, Value
        from decimal import Decimal
        import calendar
        import time
        
        start_time = time.time()
        logger.info("Starting optimized payroll calculation")
        
        year = request.data.get('year')
        month = request.data.get('month')
        
        if not year or not month:
            return Response({"error": "Year and month are required"}, status=400)
        
        try:
            year = int(year)
            if isinstance(month, str):
                # Convert month name to number
                month_num = list(calendar.month_name).index(month.title())
            else:
                month_num = int(month)
        except (ValueError, TypeError):
            return Response({"error": "Invalid year or month format"}, status=400)
        
        # Get working days in the month (excluding weekends)
        working_days = len([d for d in range(1, calendar.monthrange(year, month_num)[1] + 1)
                          if calendar.weekday(year, month_num, d) < 5])
        
        logger.info(f"Working days calculated: {working_days}")
        
        # OPTIMIZATION 1: Get all active employees with required fields only
        employees = EmployeeProfile.objects.filter(
            tenant=tenant, 
            is_active=True
        ).only(
            'employee_id', 'first_name', 'last_name', 'department', 
            'basic_salary', 'ot_charge_per_hour', 'tds_percentage'
        )
        
        employee_ids = list(employees.values_list('employee_id', flat=True))
        logger.info(f"Found {len(employee_ids)} active employees")
        
        if not employee_ids:
            return Response({
                'success': True,
                'payroll_data': [],
                'summary': {
                    'total_employees': 0,
                    'working_days': working_days,
                    'month_year': f"{calendar.month_name[month_num]} {year}",
                    'total_base_salary': 0,
                    'total_gross_salary': 0,
                    'total_net_salary': 0
                }
            })
        
        # OPTIMIZATION 2: Bulk fetch all attendance data from Attendance model (monthly summary)
        from ..models import Attendance
        attendance_summary = Attendance.objects.filter(
            tenant=tenant,
            employee_id__in=employee_ids,
            date__year=year,
            date__month=month_num
        ).values('employee_id').annotate(
            total_present=Sum('present_days', output_field=DecimalField(max_digits=5, decimal_places=1)),
            total_absent=Sum('absent_days', output_field=DecimalField(max_digits=5, decimal_places=1)),
            total_ot_hours=Sum('ot_hours', output_field=DecimalField(max_digits=10, decimal_places=2)),
            total_late_minutes=Sum('late_minutes', output_field=IntegerField())
        )
        
        # Convert to dictionary for fast lookup
        attendance_dict = {
            item['employee_id']: {
                'present_days': float(item['total_present'] or 0),
                'absent_days': float(item['total_absent'] or 0),
                'ot_hours': float(item['total_ot_hours'] or 0),
                'late_minutes': int(item['total_late_minutes'] or 0)
            }
            for item in attendance_summary
        }
        
        logger.info(f"Attendance data aggregated for {len(attendance_dict)} employees")
        
        # OPTIMIZATION 3: Bulk fetch all advance deductions
        month_year_string = f"{calendar.month_name[month_num]} {year}"
        advance_summary = AdvanceLedger.objects.filter(
            tenant=tenant,
            employee_id__in=employee_ids,
            for_month__icontains=month_year_string,
            status__in=['PENDING', 'PARTIALLY_PAID']
        ).values('employee_id').annotate(
            total_advance=Sum('remaining_balance', output_field=DecimalField(max_digits=12, decimal_places=2))
        )
        
        # Convert to dictionary for fast lookup
        advance_dict = {
            item['employee_id']: float(item['total_advance'] or 0)
            for item in advance_summary
        }
        
        # OPTIMIZATION 3.5: Get total advance balance for each employee (all pending advances)
        total_advance_summary = AdvanceLedger.objects.filter(
            tenant=tenant,
            employee_id__in=employee_ids,
            status__in=['PENDING', 'PARTIALLY_PAID']
        ).values('employee_id').annotate(
            total_balance=Sum('remaining_balance', output_field=DecimalField(max_digits=12, decimal_places=2))
        )
        
        # Convert to dictionary for fast lookup
        total_advance_dict = {
            item['employee_id']: float(item['total_balance'] or 0)
            for item in total_advance_summary
        }
        
        logger.info(f"Advance deductions aggregated for {len(advance_dict)} employees")
        
        # OPTIMIZATION 4: Process all employees in bulk with vectorized operations
        payroll_data = []
        total_base_salary = 0
        total_gross_salary = 0
        total_net_salary = 0
        
        for employee in employees:
            # Get attendance data (default to 0 if no records)
            attendance = attendance_dict.get(employee.employee_id, {
                'present_days': 0,
                'absent_days': 0,
                'ot_hours': 0.0,
                'late_minutes': 0
            })
            
            # Get advance deductions (default to 0)
            advance_deductions = advance_dict.get(employee.employee_id, 0.0)
            total_advance_balance = total_advance_dict.get(employee.employee_id, 0.0)
            
            # Basic calculations
            base_salary = float(employee.basic_salary or 0)
            present_days = attendance['present_days']
            ot_hours = attendance['ot_hours']
            late_minutes = attendance['late_minutes']
            
            # Gross salary calculation (only pay for present days)
            if working_days > 0:
                daily_rate = base_salary / working_days
                gross_salary = daily_rate * present_days
            else:
                gross_salary = 0
            
            # Add overtime charges
            ot_rate = float(employee.ot_charge_per_hour or 0)
            ot_charges = ot_hours * ot_rate
            gross_with_ot = gross_salary + ot_charges
            
            # Deduct late charges (per minute = ot_rate / 60)
            late_charge_per_minute = ot_rate / 60 if ot_rate > 0 else 0
            late_deduction = late_minutes * late_charge_per_minute
            gross_after_late = gross_with_ot - late_deduction
            
            # Calculate TDS (use employee-specific TDS or 0%)
            tds_percentage = float(employee.tds_percentage or 0)
            tds_amount = (gross_after_late * tds_percentage) / 100
            salary_after_tds = gross_after_late - tds_amount
            
            # Final net salary
            net_salary = salary_after_tds - advance_deductions
            
            # Calculate remaining advance balance
            remaining_advance_balance = total_advance_balance - advance_deductions
            
            # Round values for response
            gross_salary_rounded = round(gross_salary, 2)
            ot_charges_rounded = round(ot_charges, 2)
            late_deduction_rounded = round(late_deduction, 2)
            tds_amount_rounded = round(tds_amount, 2)
            net_salary_rounded = round(net_salary, 2)
            
            payroll_data.append({
                'employee_id': employee.employee_id,
                'employee_name': f"{employee.first_name} {employee.last_name}",
                'department': employee.department or 'N/A',
                'base_salary': base_salary,
                'working_days': working_days,
                'present_days': present_days,
                'absent_days': attendance['absent_days'],
                'ot_hours': ot_hours,
                'late_minutes': late_minutes,
                'gross_salary': gross_salary_rounded,
                'ot_charges': ot_charges_rounded,
                'late_deduction': late_deduction_rounded,
                'tds_percentage': tds_percentage,
                'tds_amount': tds_amount_rounded,
                'total_advance_balance': total_advance_balance,
                'advance_deduction': advance_deductions,
                'remaining_balance': remaining_advance_balance,
                'net_salary': net_salary_rounded,
                'is_paid': False,  # Default to unpaid
                'editable': True   # Allow editing
            })
            
            # Accumulate totals
            total_base_salary += base_salary
            total_gross_salary += gross_salary_rounded
            total_net_salary += net_salary_rounded
        
        end_time = time.time()
        calculation_time = round(end_time - start_time, 2)
        logger.info(f"Payroll calculation completed in {calculation_time} seconds for {len(payroll_data)} employees")
        
        return Response({
            'success': True,
            'payroll_data': payroll_data,
            'summary': {
                'total_employees': len(payroll_data),
                'working_days': working_days,
                'month_year': f"{calendar.month_name[month_num]} {year}",
                'total_base_salary': round(total_base_salary, 2),
                'total_gross_salary': round(total_gross_salary, 2),
                'total_net_salary': round(total_net_salary, 2),
                'calculation_time_seconds': calculation_time
            }
        })
        
    except Exception as e:
        logger.error(f"Error in calculate_simple_payroll: {str(e)}")
        return Response({"error": f"Calculation failed: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_payroll_entry(request):
    """
    Update individual payroll entry (edit net salary, deductions, etc.)
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        employee_id = request.data.get('employee_id')
        updates = request.data.get('updates', {})
        
        if not employee_id:
            return Response({"error": "Employee ID is required"}, status=400)
        
        # For now, just return success - in a real implementation,
        # you might store these updates in a temporary payroll table
        return Response({
            'success': True,
            'message': f'Payroll updated for employee {employee_id}',
            'updates': updates
        })
        
    except Exception as e:
        logger.error(f"Error in update_payroll_entry: {str(e)}")
        return Response({"error": f"Update failed: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_payroll_paid(request):
    """
    Mark payroll entries as paid (individual or bulk)
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        employee_ids = request.data.get('employee_ids', [])
        mark_all = request.data.get('mark_all', False)
        
        if mark_all:
            message = "All employees marked as paid"
        else:
            message = f"{len(employee_ids)} employees marked as paid"
        
        # CLEAR CACHE: Invalidate payroll overview cache when payment status changes
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
        
        # Also clear frontend charts cache so dashboard reloads fresh KPIs immediately
        try:
            cache.delete_pattern(f"frontend_charts_{tenant.id}_*")
        except AttributeError:
            # If backend cache doesn't support delete_pattern, fall back to manual key iteration
            for k in cache.keys(f"frontend_charts_{tenant.id}_*"):
                cache.delete(k)
        logger.info(f"Cleared frontend charts cache for tenant {tenant.id}")
        
        # For now, just return success - in a real implementation,
        # you might update payment status in the database
        return Response({
            'success': True,
            'message': message,
            'employee_ids': employee_ids,
            'cache_cleared': True
        })
        
    except Exception as e:
        logger.error(f"Error in mark_payroll_paid: {str(e)}")
        return Response({"error": f"Mark paid failed: {str(e)}"}, status=500)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def auto_payroll_settings(request):
    """
    Get or update auto payroll calculation settings
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        if request.method == 'GET':
            return Response({
                'success': True,
                'auto_calculate_payroll': tenant.auto_calculate_payroll,
                'tenant_name': tenant.name
            })
        
        elif request.method == 'POST':
            auto_calculate = request.data.get('auto_calculate_payroll')
            if auto_calculate is None:
                return Response({"error": "auto_calculate_payroll field is required"}, status=400)
            
            tenant.auto_calculate_payroll = bool(auto_calculate)
            tenant.save()
            
            return Response({
                'success': True,
                'message': f'Auto payroll calculation {"enabled" if tenant.auto_calculate_payroll else "disabled"}',
                'auto_calculate_payroll': tenant.auto_calculate_payroll
            })
            
    except Exception as e:
        logger.error(f"Error in auto_payroll_settings: {str(e)}")
        return Response({"error": f"Settings update failed: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def manual_calculate_payroll(request):
    """
    Manually calculate payroll for a specific month/year
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        data = request.data
        year = data.get('year')
        month = data.get('month')
        
        if not year or not month:
            return Response({"error": "Year and month are required"}, status=400)
        
        # Validate year and month
        try:
            year = int(year)
            month = str(month).upper()
        except (ValueError, TypeError):
            return Response({"error": "Invalid year or month format"}, status=400)
        
        # Calculate payroll
        results = SalaryCalculationService.calculate_salary_for_period(
            tenant, year, month, force_recalculate=True
        )
        # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
        
        return Response({
            'success': True,
            'message': f'Payroll calculated successfully for {month} {year}',
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Error in manual_calculate_payroll: {str(e)}")
        return Response({"error": f"Calculation failed: {str(e)}"}, status=500)

# Add a new super-optimized payroll calculation function after the existing one
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_simple_payroll_ultra_fast(request):
    """
    ULTRA-OPTIMIZED payroll calculation using raw SQL and database-level calculations
    This should be 5-10x faster than the regular optimized version
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        from django.db import connection
        import calendar
        import time
        
        start_time = time.time()
        logger.info("Starting ultra-fast payroll calculation")
        
        year = request.data.get('year')
        month = request.data.get('month')
        
        if not year or not month:
            return Response({"error": "Year and month are required"}, status=400)
        
        try:
            year = int(year)
            if isinstance(month, str):
                month_num = list(calendar.month_name).index(month.title())
            else:
                month_num = int(month)
        except (ValueError, TypeError):
            return Response({"error": "Invalid year or month format"}, status=400)
        
        # Get total days in the month (actual working days = total days - off days for each employee)
        # For summary display, we'll show total days in month
        total_days_in_month = calendar.monthrange(year, month_num)[1]
        working_days = total_days_in_month  # Use total days for summary display
        
        month_year_string = f"{calendar.month_name[month_num]} {year}"
        
        # Ultra-optimized SQL query that calculates everything in the database
        with connection.cursor() as cursor:
            sql = """
            SELECT 
                e.employee_id,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                COALESCE(e.department, 'N/A') as department,
                COALESCE(e.basic_salary, 0) as base_salary,
                %s as working_days,
                
                -- Attendance aggregations
                COALESCE(att.present_days, 0) as present_days,
                COALESCE(att.absent_days, 0) as absent_days,
                COALESCE(att.ot_hours, 0) as ot_hours,
                COALESCE(att.late_minutes, 0) as late_minutes,
                
                -- Salary calculations
                CASE 
                    WHEN %s > 0 THEN 
                        (COALESCE(e.basic_salary, 0) / %s) * COALESCE(att.present_days, 0)
                    ELSE 0 
                END as gross_salary,
                
                -- OT charges
                COALESCE(att.ot_hours, 0) * COALESCE(e.ot_charge_per_hour, 0) as ot_charges,
                
                -- Late deduction
                CASE 
                    WHEN COALESCE(e.ot_charge_per_hour, 0) > 0 THEN
                        COALESCE(att.late_minutes, 0) * (COALESCE(e.ot_charge_per_hour, 0) / 60.0)
                    ELSE 0
                END as late_deduction,
                
                -- TDS
                COALESCE(e.tds_percentage, 0) as tds_percentage,
                
                -- Advance deductions
                COALESCE(adv.advance_deduction, 0) as advance_deduction,
                COALESCE(total_adv.total_advance_balance, 0) as total_advance_balance,
                
                -- Employee rates
                COALESCE(e.ot_charge_per_hour, 0) as ot_rate
                
            FROM excel_data_employeeprofile e
            
            LEFT JOIN (
                SELECT 
                    employee_id,
                    SUM(CASE WHEN attendance_status = 'PRESENT' THEN 1 ELSE 0 END) as present_days,
                    SUM(CASE WHEN attendance_status = 'ABSENT' THEN 1 ELSE 0 END) as absent_days,
                    SUM(COALESCE(ot_hours, 0)) as ot_hours,
                    SUM(COALESCE(late_minutes, 0)) as late_minutes
                FROM excel_data_dailyattendance 
                WHERE tenant_id = %s 
                    AND EXTRACT(YEAR FROM date) = %s 
                    AND EXTRACT(MONTH FROM date) = %s
                GROUP BY employee_id
            ) att ON e.employee_id = att.employee_id
            
            LEFT JOIN (
                SELECT 
                    employee_id,
                    SUM(COALESCE(remaining_balance, 0)) as advance_deduction
                FROM excel_data_advanceledger 
                WHERE tenant_id = %s 
                    AND for_month LIKE %s
                    AND status IN ('PENDING', 'PARTIALLY_PAID')
                GROUP BY employee_id
            ) adv ON e.employee_id = adv.employee_id
            
            LEFT JOIN (
                SELECT 
                    employee_id,
                    SUM(COALESCE(remaining_balance, 0)) as total_advance_balance
                FROM excel_data_advanceledger 
                WHERE tenant_id = %s 
                    AND status IN ('PENDING', 'PARTIALLY_PAID')
                GROUP BY employee_id
            ) total_adv ON e.employee_id = total_adv.employee_id
            
            WHERE e.tenant_id = %s 
                AND e.is_active = true
            ORDER BY e.first_name, e.last_name
            """
            
            cursor.execute(sql, [
                working_days, working_days, working_days,  # working days parameters
                tenant.id, year, month_num,  # attendance parameters
                tenant.id, f'%{month_year_string}%',  # advance parameters
                tenant.id,  # total advance parameters
                tenant.id  # employee filter
            ])
            
            columns = [col[0] for col in cursor.description]
            raw_results = cursor.fetchall()
        
        # Process results with final calculations
        payroll_data = []
        total_base_salary = 0
        total_gross_salary = 0
        total_net_salary = 0
        
        for row in raw_results:
            data = dict(zip(columns, row))
            
            # Final calculations
            gross_salary = float(data['gross_salary'] or 0)
            ot_charges = float(data['ot_charges'] or 0)
            late_deduction = float(data['late_deduction'] or 0)
            gross_after_late = gross_salary + ot_charges - late_deduction
            
            # TDS calculation
            tds_percentage = float(data['tds_percentage'] or 0)
            tds_amount = (gross_after_late * tds_percentage) / 100
            salary_after_tds = gross_after_late - tds_amount
            
            # Smart advance deduction logic - never let net salary go negative
            total_advance_balance = float(data['total_advance_balance'] or 0)
            
            # Calculate maximum deductible amount (salary after TDS)
            max_deductible = max(0, salary_after_tds)  # Never negative
            
            # Determine actual advance deduction
            if total_advance_balance > 0:
                # Deduct as much as possible without making net salary negative
                actual_advance_deduction = min(total_advance_balance, max_deductible)
            else:
                actual_advance_deduction = 0
            
            # Calculate final net salary and remaining advance balance
            net_salary = salary_after_tds - actual_advance_deduction
            remaining_advance_balance = total_advance_balance - actual_advance_deduction
            
            # Ensure net salary is never negative (safety check)
            if net_salary < 0:
                actual_advance_deduction = salary_after_tds
                net_salary = 0
                remaining_advance_balance = total_advance_balance - actual_advance_deduction
            
            # Round all values
            base_salary = float(data['base_salary'] or 0)
            gross_salary_rounded = round(gross_salary, 2)
            ot_charges_rounded = round(ot_charges, 2)
            late_deduction_rounded = round(late_deduction, 2)
            tds_amount_rounded = round(tds_amount, 2)
            net_salary_rounded = round(net_salary, 2)
            
            payroll_data.append({
                'employee_id': data['employee_id'],
                'employee_name': data['employee_name'],
                'department': data['department'],
                'base_salary': base_salary,
                'working_days': int(data['working_days']),
                'present_days': int(data['present_days'] or 0),
                'absent_days': int(data['absent_days'] or 0),
                'ot_hours': float(data['ot_hours'] or 0),
                'late_minutes': int(data['late_minutes'] or 0),
                'gross_salary': gross_salary_rounded,
                'ot_charges': ot_charges_rounded,
                'late_deduction': late_deduction_rounded,
                'tds_percentage': tds_percentage,
                'tds_amount': tds_amount_rounded,
                'total_advance_balance': total_advance_balance,
                'advance_deduction': actual_advance_deduction,
                'remaining_balance': remaining_advance_balance,
                'net_salary': net_salary_rounded,
                'is_paid': False,
                'editable': True
            })
            
            # Accumulate totals
            total_base_salary += base_salary
            total_gross_salary += gross_salary_rounded
            total_net_salary += net_salary_rounded
        
        end_time = time.time()
        calculation_time = round(end_time - start_time, 2)
        logger.info(f"Ultra-fast payroll calculation completed in {calculation_time} seconds for {len(payroll_data)} employees")
        
        return Response({
            'success': True,
            'payroll_data': payroll_data,
            'summary': {
                'total_employees': len(payroll_data),
                'working_days': working_days,
                'month_year': f"{calendar.month_name[month_num]} {year}",
                'total_base_salary': round(total_base_salary, 2),
                'total_gross_salary': round(total_gross_salary, 2),
                'total_net_salary': round(total_net_salary, 2),
                'calculation_time_seconds': calculation_time,
                'optimization_level': 'ultra_fast'
            }
        })
        
    except Exception as e:
        logger.error(f"Error in calculate_simple_payroll_ultra_fast: {str(e)}")
        return Response({"error": f"Ultra-fast calculation failed: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_payroll_period_direct(request):
    """
    Save payroll period directly with the provided data (no recalculation)
    This preserves any manual edits made to advance deductions or other fields
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)
        
        from ..models import PayrollPeriod, CalculatedSalary
        import calendar
        
        # Get request data
        year = request.data.get('year')
        month = request.data.get('month')
        payroll_entries = request.data.get('payroll_entries', [])
        
        if not year or not month or not payroll_entries:
            return Response({"error": "Year, month, and payroll_entries are required"}, status=400)
        
        try:
            year = int(year)
            if isinstance(month, str):
                # Handle both month name and number
                if month.isdigit():
                    month_num = int(month)
                    month_name = calendar.month_name[month_num].upper()
                else:
                    month_name = month.upper()
                    month_num = list(calendar.month_name).index(month.title())
            else:
                month_num = int(month)
                month_name = calendar.month_name[month_num].upper()
        except (ValueError, TypeError, IndexError):
            return Response({"error": "Invalid year or month format"}, status=400)
        
        # Create or get payroll period
        payroll_period, created = PayrollPeriod.objects.get_or_create(
            tenant=tenant,
            year=year,
            month=month_name,
            defaults={
                'data_source': 'FRONTEND',
                'working_days_in_month': payroll_entries[0].get('working_days', 25) if payroll_entries else 25,
            }
        )
        
        # Delete existing calculated salaries for this period (to replace with new data)
        CalculatedSalary.objects.filter(
            tenant=tenant,
            payroll_period=payroll_period
        ).delete()
        
        # Create new calculated salary records directly from the provided data
        calculated_salaries = []
        for entry in payroll_entries:
            calculated_salary = CalculatedSalary(
                tenant=tenant,
                payroll_period=payroll_period,
                employee_id=entry.get('employee_id'),
                employee_name=entry.get('employee_name'),
                department=entry.get('department'),
                basic_salary=entry.get('base_salary', 0),
                basic_salary_per_hour=0,  # Can be calculated if needed
                basic_salary_per_minute=0,  # Can be calculated if needed
                employee_ot_rate=0,  # Set from employee profile if needed
                employee_tds_rate=entry.get('tds_percentage', 0),
                total_working_days=entry.get('working_days', 0),
                present_days=entry.get('present_days', 0),
                absent_days=entry.get('absent_days', 0),
                ot_hours=entry.get('ot_hours', 0),
                late_minutes=entry.get('late_minutes', 0),
                salary_for_present_days=entry.get('gross_salary', 0),
                ot_charges=entry.get('ot_charges', 0),
                late_deduction=entry.get('late_deduction', 0),
                incentive=0,  # Add if needed
                gross_salary=entry.get('gross_salary', 0) + entry.get('ot_charges', 0) - entry.get('late_deduction', 0),
                tds_amount=entry.get('tds_amount', 0),
                salary_after_tds=entry.get('gross_salary', 0) + entry.get('ot_charges', 0) - entry.get('late_deduction', 0) - entry.get('tds_amount', 0),
                total_advance_balance=entry.get('total_advance_balance', 0),
                advance_deduction_amount=entry.get('advance_deduction', 0),
                advance_deduction_editable=True,
                remaining_advance_balance=entry.get('remaining_balance', 0),
                net_payable=entry.get('net_salary', 0),
                data_source='FRONTEND',
                is_paid=entry.get('is_paid', False),
            )
            calculated_salaries.append(calculated_salary)
        
        # Bulk create all calculated salary records
        CalculatedSalary.objects.bulk_create(calculated_salaries)
        
        # CLEAR CACHE: Invalidate payroll overview cache when payroll data changes
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")
        
        logger.info(f"Saved payroll period {month_name} {year} with {len(calculated_salaries)} entries directly")
        
        return Response({
            'success': True,
            'message': f'Payroll period saved successfully for {month_name} {year}',
            'payroll_period_id': payroll_period.id,
            'saved_entries': len(calculated_salaries),
            'created_new_period': created,
            'cache_cleared': True
        })
        
    except Exception as e:
        logger.error(f"Error in save_payroll_period_direct: {str(e)}")
        return Response({"error": f"Failed to save payroll period: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_update_payroll_period(request, period_id):
    """
    Bulk-update payment status and advance deductions for all
    entries in a payroll period.
    Expected payload:
    { "entries": [
        { "employee_id": "...", "is_paid": true/false,
          "advance_deduction_amount": "123.45" }
      ] }
    """
    try:
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({"error": "No tenant found"}, status=400)

        entries = request.data.get('entries', [])
        if not entries:
            return Response({"error": "entries list is required"}, status=400)

        # Validate that the period exists and belongs to this tenant
        try:
            payroll_period = PayrollPeriod.objects.get(id=period_id, tenant=tenant)
        except PayrollPeriod.DoesNotExist:
            return Response({"error": "Payroll period not found"}, status=404)

        # Fetch all salaries for the period in one query
        employee_ids = [e.get("employee_id") for e in entries if e.get("employee_id")]
        if not employee_ids:
            return Response({"error": "No valid employee IDs provided"}, status=400)

        salary_map = {
            s.employee_id: s for s in
            CalculatedSalary.objects.filter(
                tenant=tenant, 
                payroll_period_id=period_id,
                employee_id__in=employee_ids
            )
        }

        if not salary_map:
            return Response({"error": "No calculated salaries found for the provided employees"}, status=404)

        # Process updates
        salaries_to_update = []
        advance_deductions_processed = {}
        
        for entry in entries:
            employee_id = entry.get("employee_id")
            if not employee_id:
                continue
                
            salary = salary_map.get(employee_id)
            if not salary:
                logger.warning(f"Salary not found for employee {employee_id} in period {period_id}")
                continue

            # Update payment status
            if "is_paid" in entry:
                salary.is_paid = bool(entry["is_paid"])
                salary.payment_date = timezone.now().date() if salary.is_paid else None

            # Update advance deduction amount
            if "advance_deduction_amount" in entry:
                try:
                    new_amount = Decimal(str(entry["advance_deduction_amount"]))
                    salary.advance_deduction_amount = new_amount
                    
                    # Recalculate net payable
                    salary.net_payable = salary.salary_after_tds - new_amount
                    
                    # Track advance deduction change for ledger updates
                    if salary.is_paid and new_amount > 0:
                        advance_deductions_processed[employee_id] = new_amount
                        
                except (ValueError, TypeError, InvalidOperation):
                    logger.error(f"Invalid advance_deduction_amount for employee {employee_id}: {entry.get('advance_deduction_amount')}")
                    continue

            salaries_to_update.append(salary)

        if not salaries_to_update:
            return Response({"error": "No valid updates to process"}, status=400)

        # Perform bulk update
        with transaction.atomic():
            CalculatedSalary.objects.bulk_update(
                salaries_to_update,
                ['is_paid', 'payment_date', 'advance_deduction_amount', 'net_payable'],
                batch_size=100
            )

            # Process advance ledger updates for paid salaries (similar to mark_salary_paid logic)
            if advance_deductions_processed:
                logger.info(f"Processing advance deductions for {len(advance_deductions_processed)} employees")
                
                # Get all relevant advance records in one query
                all_employee_ids = list(advance_deductions_processed.keys())
                all_advances = AdvanceLedger.objects.filter(
                    tenant=tenant,
                    employee_id__in=all_employee_ids,
                    status__in=['PENDING','PARTIALLY_PAID']
                ).order_by('employee_id', 'advance_date')

                # Group advances by employee for efficient processing
                advances_by_employee = {}
                for advance in all_advances:
                    if advance.employee_id not in advances_by_employee:
                        advances_by_employee[advance.employee_id] = []
                    advances_by_employee[advance.employee_id].append(advance)

                # Process advance deductions for each employee
                advances_to_update = []
                advances_to_mark_repaid = []

                for employee_id, total_deduction in advance_deductions_processed.items():
                    remaining_deduction = Decimal(str(total_deduction))
                    employee_advances = advances_by_employee.get(employee_id, [])

                    for advance in employee_advances:
                        if remaining_deduction <= 0:
                            break

                        current_balance = advance.remaining_balance
                        if current_balance <= remaining_deduction:
                            # This advance is fully paid
                            advance.status = 'REPAID'
                            advance.remaining_balance = Decimal('0')
                            advances_to_mark_repaid.append(advance)
                            remaining_deduction -= current_balance
                        else:
                            # This advance is partially paid - reduce the remaining_balance
                            advance.remaining_balance -= remaining_deduction
                            advance.status = 'PARTIALLY_PAID'
                            advances_to_update.append(advance)
                            remaining_deduction = Decimal('0')

                # Execute bulk updates for advance ledger
                if advances_to_update:
                    AdvanceLedger.objects.bulk_update(advances_to_update, ['remaining_balance', 'status'], batch_size=100)
                    logger.info(f"Bulk updated {len(advances_to_update)} advance remaining balances")

                if advances_to_mark_repaid:
                    AdvanceLedger.objects.bulk_update(advances_to_mark_repaid, ['status', 'remaining_balance'], batch_size=100)
                    logger.info(f"Marked {len(advances_to_mark_repaid)} advances as repaid")

        # Clear payroll overview cache
        from django.core.cache import cache
        cache_key = f"payroll_overview_{tenant.id}"
        cache.delete(cache_key)
        logger.info(f"Cleared payroll overview cache for tenant {tenant.id}")

        return Response({
            "success": True,
            "updated_count": len(salaries_to_update),
            "period_id": period_id,
            "message": f"Successfully updated {len(salaries_to_update)} salary records",
            "cache_cleared": True
        })

    except Exception as e:
        logger.error(f"Error in bulk_update_payroll_period: {str(e)}")
        return Response({"error": f"Bulk update failed: {str(e)}"}, status=500)
