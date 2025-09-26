from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from ..utils.utils import get_current_tenant


class Tenant(models.Model):
    """
    Tenant model for multi-tenant support
    """
    name = models.CharField(max_length=255, help_text="Organization/Company name")
    subdomain = models.CharField(max_length=100, unique=True, blank=True, null=True, help_text="Unique subdomain identifier (optional)")
    custom_domain = models.CharField(max_length=255, blank=True, null=True, help_text="Custom domain if any")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Tenant settings
    max_employees = models.IntegerField(default=1000, help_text="Maximum number of employees allowed")
    timezone = models.CharField(max_length=50, default='UTC')
    
    # Billing information (for future use)
    plan = models.CharField(max_length=50, default='free', choices=[
        ('free', 'Free'),
        ('premium', 'Premium'),
        ('enterprise', 'Enterprise')
    ])
    
    # Auto-calculate payroll setting
    auto_calculate_payroll = models.BooleanField(
        default=False,
        help_text="Automatically calculate payroll on 1st of each month for previous month"
    )
    
    class Meta:
        app_label = 'excel_data'
        verbose_name = _('tenant')
        verbose_name_plural = _('tenants')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.subdomain})"


class TenantAwareManager(models.Manager):
    """
    Manager that automatically filters by current tenant
    """
    def get_queryset(self):
        tenant = get_current_tenant()
        if tenant:
            return super().get_queryset().filter(tenant=tenant)
        return super().get_queryset()


class TenantAwareModel(models.Model):
    """
    Abstract base model that automatically adds tenant to all models
    """
    tenant = models.ForeignKey('excel_data.Tenant', on_delete=models.CASCADE, related_name='%(class)s_set')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = TenantAwareManager()
    all_objects = models.Manager()  # Access all objects regardless of tenant
    
    class Meta:
        abstract = True
        app_label = 'excel_data'
    
    def save(self, *args, **kwargs):
        if not self.tenant_id:
            self.tenant = get_current_tenant()
        super().save(*args, **kwargs)