from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import DailyAttendance, Attendance, AdvanceLedger, Payment, SalaryData, MonthlyAttendanceSummary, EmployeeProfile
from django.db.models import Sum
from datetime import date
from decimal import Decimal

@receiver([post_save, post_delete], sender=DailyAttendance)
def sync_attendance_from_daily(sender, instance, **kwargs):
    """
    Sync Attendance records from DailyAttendance - DISABLED to prevent double counting
    This signal was causing conflicts with manual attendance entry system.
    The salary calculator now reads directly from DailyAttendance for payroll calculations.
    """
    # DISABLED: This signal was causing double counting issues
    # The bulk_update_attendance function creates both DailyAttendance and Attendance records
    # The salary calculator now reads directly from DailyAttendance for accurate data
    pass

# DISABLED: These signals are trying to update a non-existent 'total_advance' field in SalaryData
# The CalculatedSalary model is now used for advance calculations instead
"""
@receiver([post_save, post_delete], sender=AdvanceLedger)
def update_total_advance_on_advance_change(sender, instance, **kwargs):
    employee_id = instance.employee_id
    # Sum all advances for this employee
    total_advance = AdvanceLedger.objects.filter(employee_id=employee_id).aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0.00')
    # Subtract all advance deductions from payments
    total_deduction = Payment.objects.filter(employee_id=employee_id).aggregate(
        total=Sum('advance_deduction')
    )['total'] or Decimal('0.00')
    # Update all SalaryData records for this employee
    SalaryData.objects.filter(employee_id=employee_id).update(total_advance=total_advance - total_deduction)

@receiver([post_save, post_delete], sender=Payment)
def update_total_advance_on_payment(sender, instance, **kwargs):
    employee_id = instance.employee_id
    # Sum all advances
    total_advance = AdvanceLedger.objects.filter(employee_id=employee_id).aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0.00')
    # Subtract all advance deductions
    total_deduction = Payment.objects.filter(employee_id=employee_id).aggregate(
        total=Sum('advance_deduction')
    )['total'] or Decimal('0.00')
    # Update all SalaryData records for this employee
    SalaryData.objects.filter(employee_id=employee_id).update(total_advance=total_advance - total_deduction)
"""

@receiver([post_save, post_delete], sender=DailyAttendance)
def update_monthly_attendance_summary(sender, instance, **kwargs):
    """Maintain per-employee MonthlyAttendanceSummary aggregates."""
    try:
        tenant = instance.tenant
        year = instance.date.year
        month = instance.date.month
        employee_id = instance.employee_id

        # Pull all daily attendance rows for the employee for the same month
        qs = DailyAttendance.objects.filter(
            tenant=tenant,
            employee_id=employee_id,
            date__year=year,
            date__month=month,
        )

        # Present counts: PRESENT and PAID_LEAVE count as 1, HALF_DAY as 0.5
        present_full = qs.filter(attendance_status__in=["PRESENT", "PAID_LEAVE"]).count()
        half_days = qs.filter(attendance_status="HALF_DAY").count()
        total_present = present_full + (half_days * 0.5)

        # Aggregate OT & late minutes
        aggregate_vals = qs.aggregate(
            ot_sum=Sum("ot_hours"),
            late_sum=Sum("late_minutes"),
        )
        ot_hours = aggregate_vals["ot_sum"] or Decimal("0")
        late_minutes = aggregate_vals["late_sum"] or 0

        # Upsert summary
        MonthlyAttendanceSummary.objects.update_or_create(
            tenant=tenant,
            employee_id=employee_id,
            year=year,
            month=month,
            defaults={
                "present_days": Decimal(str(total_present)),
                "ot_hours": ot_hours,
                "late_minutes": late_minutes,
            },
        )
    except Exception as exc:
        # Soft-fail – we don't want attendance updates to break
        import logging
        logging.getLogger(__name__).error(f"Failed to update MonthlyAttendanceSummary: {exc}") 